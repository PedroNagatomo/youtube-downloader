# Estágio 1: Build com Maven
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Estágio 2: Runtime
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app

# Instalar Python, ffmpeg e yt-dlp
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar o JAR do estágio de build
COPY --from=build /app/target/*.jar app.jar

# Criar diretório de downloads
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

# Configurar porta
ENV PORT=10000
EXPOSE 10000

# Comando para rodar
CMD ["java", "-jar", "app.jar"]