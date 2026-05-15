package com.youtubedownloader.service;

import com.youtubedownloader.model.Video;
import com.youtubedownloader.model.Video.DownloadStatus;
import com.youtubedownloader.repository.VideoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class YouTubeDownloaderService {

    private static final Logger logger = LoggerFactory.getLogger(YouTubeDownloaderService.class);
    private final Path downloadDir = Paths.get("/app/downloads");

    @Autowired
    private VideoRepository videoRepository;

    // Armazenar progresso dos downloads ativos
    private final Map<Long, String> downloadProgress = new ConcurrentHashMap<>();

    public YouTubeDownloaderService() throws IOException {
        Files.createDirectories(downloadDir);
        logger.info("Diretório de downloads criado: {}", downloadDir.toAbsolutePath());
    }

    public Video createDownloadTask(String youtubeUrl) {
        Video video = new Video();
        video.setYoutubeUrl(youtubeUrl);
        video.setTitle("Aguardando...");
        video.setStatus(DownloadStatus.PENDING);
        video.setDownloadDate(LocalDateTime.now());

        video = videoRepository.save(video);
        logger.info("Tarefa de download criada com ID: {}", video.getId());

        // Iniciar download assíncrono
        processDownloadAsync(video.getId(), youtubeUrl);

        return video;
    }

    @Async("downloadExecutor")
    public void processDownloadAsync(Long videoId, String youtubeUrl) {
        Video video = videoRepository.findById(videoId).orElse(null);
        if (video == null) return;

        video.setStatus(DownloadStatus.PROCESSING);
        videoRepository.save(video);
        downloadProgress.put(videoId, "Iniciando download...");

        try {
            // Extrair título
            updateProgress(videoId, "Extraindo informações do vídeo...");
            String title = extractVideoTitle(youtubeUrl);
            title = truncateTitle(title);
            video.setTitle(title);
            videoRepository.save(video);

            // Preparar download
            String fileName = sanitizeFileName(title) + "_" + videoId + ".mp4";
            Path outputPath = downloadDir.resolve(fileName);

            logger.info("Iniciando download assíncrono: {} (ID: {})", title, videoId);
            updateProgress(videoId, "Baixando vídeo...");

            // Download real
            boolean success = downloadWithYtDlp(youtubeUrl, outputPath, videoId);

            if (success && Files.exists(outputPath) && Files.size(outputPath) > 0) {
                video.setFilePath(outputPath.toString());
                video.setFileSize(Files.size(outputPath));
                video.setStatus(DownloadStatus.COMPLETED);
                downloadProgress.put(videoId, "COMPLETED");
                logger.info("✅ Download concluído! ID: {}, Tamanho: {} bytes", videoId, video.getFileSize());
            } else {
                video.setStatus(DownloadStatus.FAILED);
                downloadProgress.put(videoId, "FAILED");
                logger.error("❌ Download falhou ID: {}", videoId);
            }

        } catch (Exception e) {
            video.setStatus(DownloadStatus.FAILED);
            downloadProgress.put(videoId, "FAILED: " + e.getMessage());
            logger.error("Erro ao processar vídeo {}: {}", videoId, e.getMessage());
        }

        videoRepository.save(video);
    }

    public String getDownloadProgress(Long videoId) {
        return downloadProgress.getOrDefault(videoId, "PENDING");
    }

    private void updateProgress(Long videoId, String message) {
        downloadProgress.put(videoId, message);
        logger.debug("Progresso ID {}: {}", videoId, message);
    }

    private boolean downloadWithYtDlp(String youtubeUrl, Path outputPath, Long videoId) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "yt-dlp",
                    "-f", "best[ext=mp4]/best",
                    "-o", outputPath.toString(),
                    "--no-playlist",
                    "--no-check-certificate",
                    "--newline",  // Para melhor output em tempo real
                    youtubeUrl
            );

            pb.redirectErrorStream(true);
            logger.info("Comando: {}", String.join(" ", pb.command()));

            Process process = pb.start();

            // Ler saída em thread separada
            Thread outputReader = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.contains("[download]")) {
                            // Extrair percentual
                            String progress = line.replaceAll(".*?(\\d+\\.?\\d*%).*", "$1");
                            if (!progress.equals(line)) {
                                downloadProgress.put(videoId, "Baixando: " + progress);
                                logger.info("ID {}: {}", videoId, progress);
                            }
                        }
                    }
                } catch (IOException e) {
                    logger.error("Erro ao ler saída: {}", e.getMessage());
                }
            });
            outputReader.start();

            // Aguardar conclusão (timeout de 10 minutos)
            boolean finished = process.waitFor(10, java.util.concurrent.TimeUnit.MINUTES);

            if (!finished) {
                logger.error("Timeout - processo excedeu 10 minutos");
                process.destroyForcibly();
                return false;
            }

            int exitCode = process.exitValue();
            logger.info("yt-dlp finalizado com código: {}", exitCode);

            if (exitCode == 0 && Files.exists(outputPath)) {
                long fileSize = Files.size(outputPath);
                logger.info("Arquivo criado: {} ({} bytes)", outputPath.getFileName(), fileSize);
                return fileSize > 0;
            }

            return false;

        } catch (Exception e) {
            logger.error("Exceção no download: {}", e.getMessage(), e);
            return false;
        }
    }

    private String extractVideoTitle(String youtubeUrl) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "yt-dlp",
                    "--get-title",
                    "--no-playlist",
                    "--no-warnings",
                    youtubeUrl
            );

            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("WARNING") && !line.startsWith("ERROR")) {
                        output.append(line);
                    }
                }
            }

            process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS);

            String title = output.toString().trim();
            if (!title.isEmpty()) {
                return title;
            }

        } catch (Exception e) {
            logger.error("Erro ao extrair título: {}", e.getMessage());
        }

        return "Video_" + System.currentTimeMillis();
    }

    private String sanitizeFileName(String fileName) {
        String sanitized = fileName
                .replaceAll("[<>:\"/\\\\|?*\\x00-\\x1F\\x7F]", "_")
                .replaceAll("\\s+", "_")
                .replaceAll("_{2,}", "_")
                .trim();

        if (sanitized.length() > 100) {
            sanitized = sanitized.substring(0, 100);
        }

        return sanitized;
    }

    private String truncateTitle(String title) {
        if (title.length() > 490) {
            return title.substring(0, 490) + "...";
        }
        return title;
    }

    public void removeProgress(Long videoId) {
        downloadProgress.remove(videoId);
    }

    public void clearAllProgress() {
        downloadProgress.clear();
    }
}