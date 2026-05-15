package com.youtubedownloader.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "videos")
public class Video {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String youtubeUrl;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(nullable = true, length = 1000)
    private String filePath;

    @Column(nullable = true)
    private Long fileSize;

    @Column(nullable = false)
    private LocalDateTime downloadDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DownloadStatus status;

    public enum DownloadStatus {
        PENDING, PROCESSING, COMPLETED, FAILED
    }

    public Video() {
        this.status = DownloadStatus.PENDING;
        this.downloadDate = LocalDateTime.now();
    }
}