import React, { useState, useEffect, useCallback } from 'react';

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [downloads, setDownloads] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  // Função auxiliar para requisições GET
  const fetchAPI = useCallback(async (endpoint) => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Erro na requisição GET:', err);
      throw err;
    }
  }, []);

  // Função auxiliar para requisições POST/DELETE
  const apiRequest = useCallback(async (endpoint, options = {}) => {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...defaultOptions,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (err) {
      console.error('Erro na requisição:', err);
      throw err;
    }
  }, []);

  // Buscar downloads
  const fetchDownloads = useCallback(async () => {
    try {
      const data = await fetchAPI('/downloads');
      setDownloads(data);
    } catch (err) {
      console.error('Erro ao buscar downloads:', err);
    }
  }, [fetchAPI]);

  // Intervalo de atualização
  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 3000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  // Auto-limpar mensagem de sucesso
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Submeter novo download
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!youtubeUrl.trim()) return;

    const urls = youtubeUrl
      .split(/[\n,]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) return;

    setIsLoading(true);

    try {
      if (urls.length === 1) {
        await apiRequest('/download', {
          method: 'POST',
          body: JSON.stringify({ url: urls[0] }),
        });
      } else {
        await apiRequest('/download/batch', {
          method: 'POST',
          body: JSON.stringify({ urls: urls }),
        });
      }

      setYoutubeUrl('');
      setSuccessMessage(`${urls.length} download(s) adicionado(s) à fila!`);
      await fetchDownloads();
    } catch (err) {
      setError('Erro ao iniciar download. Verifique a URL.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Download do arquivo
  const handleDownload = async (downloadId) => {
    if (!downloadId) {
      setError('ID do download não encontrado');
      return;
    }

    try {
      setError('');
      console.log('Baixando arquivo do download ID:', downloadId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutos

      const response = await fetch(
        `${API_URL}/download-file/${downloadId}`,
        {
          method: 'GET',
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Arquivo não encontrado no servidor');
        } else {
          setError(`Erro ${response.status}: ${response.statusText}`);
        }
        return;
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        setError('Arquivo vazio ou não encontrado');
        return;
      }

      // Criar URL e fazer download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `video_${downloadId}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Download iniciado com sucesso!');
    } catch (err) {
      console.error('Erro ao baixar:', err);

      if (err.name === 'AbortError') {
        setError('Tempo limite excedido (5 minutos)');
      } else {
        setError('Erro ao baixar o arquivo');
      }
    }
  };

  // Deletar um item
  const handleDelete = async (id) => {
    if (deletingId === id) return;

    if (!window.confirm('Tem certeza que deseja remover este item?')) {
      return;
    }

    setDeletingId(id);
    try {
      await apiRequest(`/download/${id}`, {
        method: 'DELETE',
      });
      setSuccessMessage('Item removido com sucesso!');
      await fetchDownloads();
    } catch (err) {
      setError('Erro ao deletar item.');
      console.error('Erro ao deletar:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Deletar todos os itens
  const handleDeleteAll = async () => {
    if (!window.confirm('Tem certeza que deseja remover TODOS os downloads?')) {
      return;
    }

    try {
      const result = await apiRequest('/downloads', {
        method: 'DELETE',
      });
      setSuccessMessage(`${result?.count || 'Vários'} item(ns) removido(s)!`);
      await fetchDownloads();
    } catch (err) {
      setError('Erro ao deletar todos os itens.');
      console.error('Erro ao deletar todos:', err);
    }
  };

  // Formatar tamanho de arquivo
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
  };

  // Badge de status
  const getStatusBadge = (status) => {
    const badges = {
      PENDING: 'bg-amber-500/10 text-amber-600 border-amber-300',
      PROCESSING: 'bg-blue-500/10 text-blue-600 border-blue-300',
      COMPLETED: 'bg-emerald-500/10 text-emerald-600 border-emerald-300',
      FAILED: 'bg-red-500/10 text-red-600 border-red-300',
    };
    return badges[status] || 'bg-slate-500/10 text-slate-600 border-slate-300';
  };

  // Texto de status
  const getStatusText = (status) => {
    const texts = {
      PENDING: 'Na fila',
      PROCESSING: 'Baixando',
      COMPLETED: 'Concluído',
      FAILED: 'Falhou',
    };
    return texts[status] || status;
  };

  // Contar downloads
  const activeDownloads = downloads.filter(
    d => d.status === 'PENDING' || d.status === 'PROCESSING'
  ).length;
  const completedDownloads = downloads.filter(d => d.status === 'COMPLETED').length;
  const failedDownloads = downloads.filter(d => d.status === 'FAILED').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50">
      {/* Elemento decorativo de fundo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white mb-4 shadow-lg">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent mb-3">
            Video Downloader
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            Download vídeos do YouTube com facilidade e velocidade
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-slate-200/50 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Cole sua URL do YouTube
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... ou múltiplas URLs separadas por vírgula"
                    disabled={isLoading}
                    className="w-full px-6 py-4 rounded-xl bg-slate-50 text-slate-900 
                             border-2 border-slate-200 focus:outline-none focus:border-blue-500 
                             focus:ring-2 focus:ring-blue-200 focus:bg-white
                             placeholder-slate-400 transition-all duration-200
                             font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {youtubeUrl.includes(',') || youtubeUrl.includes('\n') ? (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 
                                   text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      {youtubeUrl.split(/[\n,]+/).filter((u) => u.trim()).length} links
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Você pode colar uma URL ou múltiplas URLs separadas por vírgula ou quebras de linha
                </p>
              </div>

              <button
                type="submit"
                disabled={!youtubeUrl.trim() || isLoading}
                className="w-full px-8 py-4 bg-gradient-to-r from-red-500 to-orange-600 
                         text-white rounded-xl font-bold text-lg
                         hover:from-red-600 hover:to-orange-700 
                         active:scale-95
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-500 disabled:hover:to-orange-600
                         transition-all duration-200 shadow-lg hover:shadow-xl
                         flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2.5 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Adicionar à Fila
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Alert Messages */}
          {error && (
            <div
              className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg 
                          flex items-start justify-between gap-4 animate-slide-down"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <div>
                  <p className="font-semibold text-red-900">{error}</p>
                </div>
              </div>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 flex-shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              </button>
            </div>
          )}

          {successMessage && (
            <div
              className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-lg 
                          flex items-start justify-between gap-4 animate-slide-down"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <div>
                  <p className="font-semibold text-emerald-900">{successMessage}</p>
                </div>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-emerald-500 hover:text-emerald-700 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              </button>
            </div>
          )}

          {/* Downloads Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-1">Meus Downloads</h2>
                <p className="text-slate-600 text-sm font-medium">
                  {downloads.length === 0 ? 'Nenhum download na fila' : `${downloads.length} item${downloads.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {downloads.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="px-4 py-2 bg-red-50 border-2 border-red-200 text-red-600 
                           rounded-xl text-sm font-bold hover:bg-red-100 
                           transition-all duration-200 flex items-center justify-center gap-2
                           active:scale-95"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z" />
                  </svg>
                  Limpar Tudo
                </button>
              )}
            </div>

            {downloads.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-100 mb-4">
                  <svg className="w-10 h-10 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </div>
                <p className="text-xl font-bold text-slate-900 mb-1">Nenhum download ainda</p>
                <p className="text-slate-600">Cole um link do YouTube acima para começar a fazer downloads</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloads.map((download) => (
                  <div
                    key={download.id}
                    className="bg-white rounded-xl border-2 border-slate-200 p-5 
                             hover:border-slate-300 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-slate-900 font-bold truncate mb-3">{download.title}</h3>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold ${getStatusBadge(download.status)}`}>
                            {getStatusText(download.status)}
                          </span>

                          {download.status === 'PROCESSING' && download.progress && (
                            <span className="text-blue-600 font-semibold text-xs">{download.progress}</span>
                          )}

                          {download.fileSize && (
                            <span className="text-slate-600 text-xs font-medium">{formatFileSize(download.fileSize)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {download.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleDownload(download.id)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white 
                                     rounded-lg text-sm font-bold transition-all duration-200
                                     flex items-center gap-2 active:scale-95 shadow-md hover:shadow-lg"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                            Baixar
                          </button>
                        )}

                        {download.status === 'PROCESSING' && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2.5 border-blue-300 border-t-blue-500 rounded-full animate-spin"></div>
                          </div>
                        )}

                        {download.status === 'FAILED' && <span className="text-red-600 font-bold text-sm">⚠️ Erro</span>}

                        <button
                          onClick={() => handleDelete(download.id)}
                          disabled={deletingId === download.id}
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 
                                   rounded-lg transition-all duration-200 opacity-0 sm:opacity-100 sm:group-hover:opacity-100
                                   disabled:opacity-50 active:scale-90"
                          title="Remover item"
                        >
                          {deletingId === download.id ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {download.status === 'PROCESSING' && (
                      <div className="mt-4 space-y-2">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-400 h-full 
                                     rounded-full transition-all duration-300"
                            style={{ width: '60%' }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stats Section */}
            {downloads.length > 0 && (
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border-2 border-slate-200 p-5 text-center">
                  <div className="text-3xl font-bold text-slate-900">{downloads.length}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-1">Total</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-emerald-200 p-5 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{completedDownloads}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-1">Concluídos</div>
                </div>
                <div className="bg-white rounded-xl border-2 border-blue-200 p-5 text-center">
                  <div className="text-3xl font-bold text-blue-600">{activeDownloads}</div>
                  <div className="text-xs font-semibold text-slate-600 mt-1">Em andamento</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default App;