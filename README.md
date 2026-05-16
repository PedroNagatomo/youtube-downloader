# 🎥 YouTube Downloader

Aplicação full-stack para baixar vídeos do YouTube em formato MP4, com suporte a múltiplos downloads simultâneos.

## 🚀 Tecnologias

### Backend
- Java 17
- Spring Boot 3.2
- PostgreSQL 15
- yt-dlp (download real)
- Docker

### Frontend
- React.js 18
- TailwindCSS 3
- Axios

## 📋 Funcionalidades

- ✅ Download de vídeos do YouTube em MP4
- ✅ Múltiplos downloads simultâneos
- ✅ Barra de progresso em tempo real
- ✅ Histórico de downloads
- ✅ Deletar itens individualmente ou todos
- ✅ Suporte a múltiplas URLs (separadas por vírgula ou linha)
- ✅ Interface responsiva e moderna

## 🛠️ Como Rodar

### Pré-requisitos
- Docker e Docker Compose
- Java 17 (para desenvolvimento)
- Maven (para desenvolvimento)

### Com Docker (Recomendado)

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/youtube-downloader.git
cd youtube-downloader

# Build do backend
cd backend
./mvnw clean package -DskipTests
cd ..

# Iniciar com Docker Compose
docker-compose up --build