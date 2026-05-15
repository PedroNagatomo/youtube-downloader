FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Instalar Python e yt-dlp para download real dos vídeos
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY target/*.jar app.jar

# Criar diretório de downloads com permissões
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]