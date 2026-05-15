package com.youtubedownloader.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "message", "YouTube Downloader API está rodando!",
                "endpoints", Map.of(
                        "download", "POST /api/download",
                        "downloadFile", "GET /api/download-file"
                )
        ));
    }

    @GetMapping("/api/health")
    public ResponseEntity<?> apiHealth() {
        return ResponseEntity.ok(Map.of("status", "OK"));
    }
}