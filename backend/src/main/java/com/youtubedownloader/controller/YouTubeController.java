package com.youtubedownloader.controller;

import com.youtubedownloader.model.Video;
import com.youtubedownloader.repository.VideoRepository;
import com.youtubedownloader.service.YouTubeDownloaderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import javax.swing.text.html.Option;
import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://frontend:3000"})
public class YouTubeController {

    private static final Logger logger = LoggerFactory.getLogger(YouTubeController.class);

    @Autowired
    private YouTubeDownloaderService downloaderService;

    @Autowired
    private VideoRepository videoRepository;

    @PostMapping("/download")
    public ResponseEntity<?> downloadVideo(@RequestBody Map<String, String> request) {
        try {
            String youtubeUrl = request.get("url");

            if (youtubeUrl == null || youtubeUrl.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "URL do YouTube é obrigatória"));
            }

            if (!youtubeUrl.contains("youtube.com/") && !youtubeUrl.contains("youtu.be/")) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "URL inválida. Use um link do YouTube"));
            }

            logger.info("📥 Nova solicitação de download: {}", youtubeUrl);

            // Criar tarefa e iniciar download assíncrono
            Video video = downloaderService.createDownloadTask(youtubeUrl);

            Map<String, Object> response = new HashMap<>();
            response.put("id", video.getId());
            response.put("title", video.getTitle());
            response.put("status", video.getStatus().toString());
            response.put("message", "Download iniciado com sucesso");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("❌ Erro no controller: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno: " + e.getMessage()));
        }
    }

    @GetMapping("/downloads")
    public ResponseEntity<?> getAllDownloads() {
        try {
            List<Video> videos = videoRepository.findAllByOrderByDownloadDateDesc();

            List<Map<String, Object>> response = new ArrayList<>();
            for (Video video : videos) {
                Map<String, Object> videoMap = new HashMap<>();
                videoMap.put("id", video.getId());
                videoMap.put("title", video.getTitle());
                videoMap.put("status", video.getStatus().toString());
                videoMap.put("progress", downloaderService.getDownloadProgress(video.getId()));
                videoMap.put("fileSize", video.getFileSize());
                videoMap.put("downloadDate", video.getDownloadDate().toString());
                response.add(videoMap);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<?> getDownloadStatus(@PathVariable Long id) {
        try {
            Optional<Video> videoOpt = videoRepository.findById(id);
            if (videoOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Video video = videoOpt.get();
            Map<String, Object> response = new HashMap<>();
            response.put("id", video.getId());
            response.put("title", video.getTitle());
            response.put("status", video.getStatus().toString());
            response.put("progress", downloaderService.getDownloadProgress(video.getId()));
            response.put("filePath", video.getFilePath());
            response.put("fileSize", video.getFileSize());
            response.put("downloadDate", video.getDownloadDate().toString());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/download-file")
    public ResponseEntity<?> downloadFile(@RequestParam(required = false) String filePath) {
        try {
            // Validar se filePath foi fornecido
            if (filePath == null || filePath.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Parâmetro 'filePath' é obrigatório"));
            }

            logger.info("📤 Solicitação de download: {}", filePath);

            // Decodificar URL se necessário
            try {
                filePath = java.net.URLDecoder.decode(filePath, "UTF-8");
            } catch (Exception e) {
                // Se não conseguir decodificar, usa o valor original
            }

            Path path = Paths.get(filePath);

            // Verificar se o arquivo existe
            if (!Files.exists(path)) {
                logger.error("Arquivo não encontrado: {}", filePath);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Arquivo não encontrado: " + filePath));
            }

            // Verificar se é um arquivo regular
            if (!Files.isRegularFile(path)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "O caminho não é um arquivo válido"));
            }

            // Verificar tamanho do arquivo
            long fileSize = Files.size(path);
            if (fileSize == 0) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "O arquivo está vazio"));
            }

            logger.info("Servindo arquivo: {} ({} bytes)", path.getFileName(), fileSize);

            Resource resource = new FileSystemResource(path);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDisposition(
                    ContentDisposition.attachment()
                            .filename(path.getFileName().toString())
                            .build()
            );
            headers.setContentLength(fileSize);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resource);

        } catch (Exception e) {
            logger.error("Erro ao baixar arquivo: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao baixar arquivo: " + e.getMessage()));
        }
    }

    @PostMapping("/download/batch")
    public ResponseEntity<?> downloadMultipleVideos(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> urls = (List<String>) request.get("urls");

            if (urls == null || urls.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Lista de URLs é obrigatória"));
            }

            List<Map<String, Object>> results = new ArrayList<>();

            for (String url : urls) {
                if (url != null && !url.trim().isEmpty() &&
                        (url.contains("youtube.com/") || url.contains("youtu.be/"))) {
                    Video video = downloaderService.createDownloadTask(url.trim());
                    Map<String, Object> videoMap = new HashMap<>();
                    videoMap.put("id", video.getId());
                    videoMap.put("url", url);
                    videoMap.put("status", "queued");
                    results.add(videoMap);
                }
            }

            return ResponseEntity.ok(Map.of(
                    "message", results.size() + " downloads iniciados",
                    "downloads", results
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/download/{id}")
    public ResponseEntity<?> deleteDonwload(@PathVariable Long id){
        try{
            Optional<Video> videoOpt = videoRepository.findById(id);

            if(videoOpt.isEmpty()){
                return ResponseEntity.notFound().build();
            }

            Video video = videoOpt.get();

            if (video.getFilePath() != null){
                try{
                    Path filePath = Paths.get(video.getFilePath());
                    Files.deleteIfExists(filePath);
                    logger.info("Arquivo deletado: {}", video.getFilePath());
                } catch(IOException e){
                    logger.warn("Não foi possível deletar o arquivo: {}", e.getMessage());
                }
            }

            downloaderService.removeProgress(id);

            // Deletar do banco
            videoRepository.delete(video);

            logger.info("Download {} deletado com sucesso", id);

            return ResponseEntity.ok(Map.of(
                    "message", "Download deletado com sucesso",
                    "id", id
            ));

        } catch (Exception e) {
            logger.error("Erro ao deletar download {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao deletar: " + e.getMessage()));
        }
    }

    @DeleteMapping("/downloads")
    public ResponseEntity<?> deleteAllDownloads() {
        try {
            List<Video> allVideos = videoRepository.findAll();
            int count = 0;

            for (Video video : allVideos) {
                // Deletar arquivo se existir
                if (video.getFilePath() != null) {
                    try {
                        Path filePath = Paths.get(video.getFilePath());
                        Files.deleteIfExists(filePath);
                    } catch (IOException e) {
                        logger.warn("Não foi possível deletar arquivo: {}", e.getMessage());
                    }
                }
                videoRepository.delete(video);
                count++;
            }

            // Limpar mapa de progresso
            downloaderService.clearAllProgress();

            logger.info("Todos os downloads foram deletados: {} itens", count);

            return ResponseEntity.ok(Map.of(
                    "message", "Todos os downloads foram deletados",
                    "count", count
            ));

        } catch (Exception e) {
            logger.error("Erro ao deletar todos os downloads: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao deletar: " + e.getMessage()));
        }
    }

    @GetMapping("/download-file/{videoId}")
    public ResponseEntity<?> downloadFileById(@PathVariable Long videoId) {
        try {
            Optional<Video> videoOpt = videoRepository.findById(videoId);

            if (videoOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Download não encontrado"));
            }

            Video video = videoOpt.get();

            if (video.getStatus() != Video.DownloadStatus.COMPLETED) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Download ainda não está completo. Status: " + video.getStatus()));
            }

            if (video.getFilePath() == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Caminho do arquivo não definido"));
            }

            Path path = Paths.get(video.getFilePath());

            if (!Files.exists(path)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Arquivo não encontrado no servidor"));
            }

            long fileSize = Files.size(path);
            Resource resource = new FileSystemResource(path);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDisposition(
                    ContentDisposition.attachment()
                            .filename(path.getFileName().toString())
                            .build()
            );
            headers.setContentLength(fileSize);

            logger.info("📤 Enviando arquivo do download ID {}: {} ({} bytes)",
                    videoId, path.getFileName(), fileSize);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resource);

        } catch (Exception e) {
            logger.error("Erro ao baixar arquivo por ID {}: {}", videoId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao baixar arquivo: " + e.getMessage()));
        }
    }
}