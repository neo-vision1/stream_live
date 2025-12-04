"use client";

import React, { useState, useEffect } from 'react';
// IMPORTANTE: A linha 'import MuxPlayer from "@mux/mux-player-react";' não é suportada 
// neste ambiente de ficheiro único React. Em vez disso, usamos o Mux Player Web Component (<mux-player>), 
// que é carregado dinamicamente no <head> para fornecer a mesma funcionalidade.

// --- CONFIGURAÇÕES E DADOS DE TESTE ---
// Playback ID de teste padrão (VOD Mux de demonstração)
const DEFAULT_PLAYBACK_ID = 'W72UFolv01VI00hiyh004TLbxVO300Osr300901Kp84HXGfBE'; 
const DEFAULT_RTMP_KEY = '8e2849be-3829-8a6b-2bc4-bce86a83bf62';
const RTMP_BASE_URL = 'rtmp://global-live.mux.com:5222/app/';

// Simulação de feeds de drones secundários.
const SECONDARY_DRONES = [
    { id: 2, name: 'Drone Bravo (Secundário)' },
    { id: 3, name: 'Drone Charlie (Monitoramento)' },
    { id: 4, name: 'Drone Delta (Reserva)' },
];

// Tipagem para configuração e utilizadores
interface DroneConfig {
    playbackId: string;
    rtmpKey: string;
}
interface StoredUser {
    name: string;
    id: string;
}

// Declaramos a interface para o componente web, pois o TypeScript não o reconhece nativamente.
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'mux-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                'playback-id': string;
                'stream-type': string;
                controls: boolean;
                autoplay: boolean;
                muted: boolean;
                style: React.CSSProperties;
            }, HTMLElement>;
        }
    }
}

// --- FUNÇÕES DE ARMAZENAMENTO SIMPLES (USANDO LOCALSTORAGE PARA PERSISTÊNCIA) ---
const saveUser = (user: StoredUser) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
};
const loadUser = (): StoredUser | null => {
    try {
        const savedUser = localStorage.getItem('currentUser');
        return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
        console.error("Erro ao carregar utilizador:", e);
        return null;
    }
};

// --- COMPONENTES AUXILIARES ---

// Componente para copiar texto para a área de transferência
const CopyButton: React.FC<{ textToCopy: string, label: string }> = ({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = textToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            // Usando execCommand para máxima compatibilidade em iframes
            document.execCommand('copy'); 
            document.body.removeChild(tempInput);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Falha ao copiar:', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            style={styles.copyButton}
            title={`Copiar ${label}`}
        >
            {copied ? '✅ Copiado!' : `📋 Copiar ${label}`}
        </button>
    );
};

// Componente Player simplificado usando o Mux Web Component
const DroneStreamPlayer: React.FC<{ playbackId: string, droneName: string }> = ({ playbackId }) => {
    // Usamos a tag <mux-player> diretamente.
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={styles.statusOverlay}>
                Status: MuxPlayer pronto. (Playback ID: {playbackId})
            </div>
            
            {/* O Mux Web Component lida com a reprodução HLS e erros (como 404) automaticamente. */}
            <mux-player
                playback-id={playbackId}
                stream-type="live" // Define como Live Stream
                style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                controls
                autoplay
                muted
            />
        </div>
    );
};


export default function DroneDashboard() {
    // --- ESTADOS ---
    const [username, setUsername] = useState('');
    const [user, setUser] = useState<StoredUser | null>(null);
    const [isMultiView, setIsMultiView] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [config, setConfig] = useState<DroneConfig>({
        playbackId: DEFAULT_PLAYBACK_ID,
        rtmpKey: DEFAULT_RTMP_KEY,
    });

    // --- PERSISTÊNCIA & CARREGAMENTO DE SCRIPT (CARREGAR ESTADOS INICIAIS) ---
    useEffect(() => {
        // 1. Carrega o Mux Player Web Component Script
        // Isso permite o uso da tag <mux-player> no nosso JSX.
        if (typeof document !== 'undefined' && !document.querySelector('script[src*="mux-player"]')) {
            const script = document.createElement('script');
            // Usamos a URL Unpkg para carregar o Web Component de forma independente.
            script.src = 'https://unpkg.com/@mux/mux-player';
            script.async = true;
            document.head.appendChild(script);
            console.log("Mux Player Web Component script loaded.");
        }

        // 2. Carrega o utilizador da sessão anterior
        setUser(loadUser());

        // 3. Carrega a configuração do drone (IDs)
        const savedConfig = localStorage.getItem('droneConfig');
        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
        }
    }, []);

    // --- FUNÇÕES DE AUTENTICAÇÃO E CONFIGURAÇÃO ---
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        // Gera um ID único simples e guarda a sessão
        const uniqueId = `user-${Math.floor(Math.random() * 10000)}`;
        const loggedUser = { name: username, id: uniqueId };
        setUser(loggedUser);
        saveUser(loggedUser);
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
    };

    const saveConfig = (e: React.FormEvent, newPlaybackId: string, newRtmpKey: string) => {
        e.preventDefault();
        const newConfig = {
            playbackId: newPlaybackId.trim(),
            rtmpKey: newRtmpKey.trim(),
        };
        setConfig(newConfig);
        localStorage.setItem('droneConfig', JSON.stringify(newConfig));
        setIsConfigOpen(false);
    };

    const toggleView = () => setIsMultiView(!isMultiView);

    // --- RENDERIZAÇÃO: TELA DE CONFIGURAÇÃO (Formulário) ---
    const ConfigForm = () => {
        const [tempPlaybackId, setTempPlaybackId] = useState(config.playbackId);
        const [tempRtmpKey, setTempRtmpKey] = useState(config.rtmpKey);

        const fullRtmpUrl = RTMP_BASE_URL + tempRtmpKey;

        return (
            <div style={styles.configContainer}>
                <div style={styles.configHeader} onClick={() => setIsConfigOpen(!isConfigOpen)}>
                    <h3>
                        {isConfigOpen ? '➖' : '➕'} Configuração do Drone Principal (ID 1)
                    </h3>
                </div>
                {isConfigOpen && (
                    <form onSubmit={(e) => saveConfig(e, tempPlaybackId, tempRtmpKey)} style={styles.configForm}>

                        {/* --- Seção de Instruções de Transmissão RTMP --- */}
                        <div style={styles.rtmpInstructions}>
                            <h4>🚀 Para Iniciar a Transmissão (Streaming):</h4>
                            <p>1. O seu drone (ou software de codificação como OBS Studio) deve enviar o vídeo para o URL abaixo.</p>
                            <p>2. **VERIFIQUE O MUX:** Confirme no seu painel Mux que a Live Stream está no estado **"Active"** (Ativa). O player só funcionará se o Mux estiver a receber o sinal RTMP.</p>
                        </div>
                        
                        {/* INPUT: CHAVE DE STREAM */}
                        <label style={styles.configLabel}>Chave de Stream (RTMP Key):</label>
                        <div style={styles.rtmpInputGroup}>
                            <input
                                type="text"
                                value={tempRtmpKey}
                                onChange={(e) => setTempRtmpKey(e.target.value)}
                                placeholder="Cole a Stream Key aqui (Ex: sua_chave_de_stream_mux)"
                                style={styles.inputRtmp}
                                required
                            />
                            <CopyButton textToCopy={tempRtmpKey} label="Chave" />
                        </div>
                        <small style={styles.helpText}>Esta chave é usada para ENVIAR o vídeo para o Mux.</small>

                        {/* INPUT: URL RTMP COMPLETA */}
                        <label style={styles.configLabel}>URL RTMP Completa para o Codificador:</label>
                        <div style={styles.rtmpInputGroup}>
                            <div style={styles.rtmpDisplay}>
                                {fullRtmpUrl}
                            </div>
                            <CopyButton textToCopy={fullRtmpUrl} label="URL" />
                        </div>
                        <small style={styles.helpText}>Para OBS Studio: Servidor RTMP é *{RTMP_BASE_URL}* e a Chave de Stream é a *chave acima*.</small>
                        <hr style={{ border: 'none', borderBottom: '1px solid #333', margin: '15px 0' }} />

                        {/* INPUT: ID DE REPRODUÇÃO */}
                        <label style={styles.configLabel}>ID de Reprodução (Mux Playback ID):</label>
                        <div style={styles.rtmpInputGroup}>
                            <input
                                type="text"
                                value={tempPlaybackId}
                                onChange={(e) => setTempPlaybackId(e.target.value)}
                                placeholder="Cole o Playback ID aqui (Ex: ce55dde1...)"
                                style={styles.inputRtmp}
                                required
                            />
                            <CopyButton textToCopy={tempPlaybackId} label="ID" />
                        </div>
                        <small style={styles.helpText}>
                            **AVISO:** O ID de Reprodução padrão é um vídeo de teste. Para ver o seu stream ao vivo,
                            deve substituí-lo pelo Playback ID do seu Live Stream Mux **ativo**.
                        </small>

                        <div style={styles.securityWarning}>
                            <h4>Player Ativo</h4>
                            <p>Estamos a usar o Mux Player Web Component, que oferece uma reprodução HLS robusta. O problema 404 será resolvido assim que o Playback ID corresponder a um stream ativo no Mux.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                            <button type="button" onClick={() => setIsConfigOpen(false)} style={styles.buttonSecondary}>
                                Cancelar
                            </button>
                            <button type="submit" style={styles.buttonPrimary}>
                                Salvar Configuração
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    };


    // --- RENDERIZAÇÃO: TELA DE LOGIN ---
    if (!user) {
        return (
            <div style={styles.loginContainer}>
                <div style={styles.loginBox}>
                    <h1 style={{ marginBottom: '1rem' }}>Acesso Restrito ao Drone</h1>
                    <form onSubmit={handleLogin} style={styles.form}>
                        <input
                            type="text"
                            placeholder="Digite seu nome de operador"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                            required
                        />
                        <button type="submit" style={styles.buttonPrimary}>
                            Entrar no Sistema
                        </button>
                        <small style={styles.helpText}>O login é salvo localmente para facilitar o teste.</small>
                    </form>
                </div>
            </div>
        );
    }

    // --- RENDERIZAÇÃO: DASHBOARD DO DRONE ---
    // Os feeds secundários usam o mesmo Playback ID do feed principal
    const activeFeeds = [
        { id: 1, name: 'Drone Alpha (Principal)', playbackId: config.playbackId },
        ...SECONDARY_DRONES.map(drone => ({ ...drone, playbackId: config.playbackId }))
    ];

    return (
        <div style={styles.dashboardContainer}>
            {/* Cabeçalho */}
            <header style={styles.header}>
                <div>
                    <h2 style={{ margin: 0 }}>Central de Comando de Drones</h2>
                    <small style={{ color: '#ccc' }}>
                        Operador: {user.name} | ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
                    </small>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} style={styles.buttonSecondary}>
                        ⚙️ {isConfigOpen ? 'Fechar Config' : 'Configurar Stream'}
                    </button>
                    <button onClick={toggleView} style={styles.buttonSecondary}>
                        {isMultiView ? '👁️ Ver Único' : '🎥 Ver Múltiplos (Grid)'}
                    </button>
                    <button onClick={handleLogout} style={styles.buttonDanger}>
                        Sair
                    </button>
                </div>
            </header>

            {/* Formulário de Configuração (Abre/Fecha) */}
            <ConfigForm />


            {/* Área de Vídeo */}
            <main style={styles.mainContent}>
                <div style={isMultiView ? styles.gridContainer : styles.singleContainer}>

                    {(isMultiView ? activeFeeds : [activeFeeds[0]]).map((drone) => (
                        <div key={drone.id} style={styles.videoCard}>
                            <div style={styles.videoHeader}>
                                {/* O statusDot usa uma cor simples para o drone principal (ID 1) */}
                                <span style={drone.id === 1 ? styles.statusDotActive : styles.statusDotInactive}></span>
                                {drone.name}
                            </div>
                            <div style={styles.playerWrapper}>
                                <DroneStreamPlayer
                                    playbackId={drone.playbackId}
                                    droneName={drone.name}
                                />
                            </div>
                        </div>
                    ))}

                </div>
            </main>
        </div>
    );
}

// --- ESTILOS (CSS-in-JS) ---
const styles: { [key: string]: React.CSSProperties } = {
    loginContainer: {
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '20px',
    },
    loginBox: {
        padding: '2rem',
        backgroundColor: '#222',
        borderRadius: '12px',
        border: '1px solid #333',
        textAlign: 'center' as const,
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
    },
    form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    input: {
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '1rem',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
    },
    inputRtmp: {
        flex: 1,
        padding: '10px',
        borderRadius: '6px 0 0 6px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '0.9rem',
    },
    buttonPrimary: {
        padding: '12px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background-color 0.2s, transform 0.1s',
        marginTop: '0.5rem',
        boxShadow: '0 4px 6px rgba(0, 112, 243, 0.3)',
    },
    buttonSecondary: {
        padding: '8px 16px',
        backgroundColor: '#333',
        color: 'white',
        border: '1px solid #555',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, border-color 0.2s',
    },
    buttonDanger: {
        padding: '8px 16px',
        backgroundColor: '#e00',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    copyButton: {
        padding: '10px 15px',
        backgroundColor: '#0f0',
        color: '#111',
        border: 'none',
        borderRadius: '0 6px 6px 0',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        transition: 'background-color 0.2s',
        whiteSpace: 'nowrap' as const,
    },
    dashboardContainer: {
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '1rem 2rem',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    mainContent: {
        flex: 1,
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
    },
    singleContainer: {
        width: '100%',
        maxWidth: '1000px',
        height: '60vh', // Altura relativa para melhor adaptação
    },
    gridContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        width: '100%',
    },
    videoCard: {
        backgroundColor: '#000',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '2px solid #333',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '300px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
    },
    videoHeader: {
        padding: '0.75rem 1rem',
        backgroundColor: '#111',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        fontSize: '1rem',
        fontWeight: 'bold',
    },
    statusDotActive: {
        height: '10px',
        width: '10px',
        backgroundColor: '#0f0',
        borderRadius: '50%',
        display: 'inline-block',
        marginRight: '8px',
        boxShadow: '0 0 5px #0f0',
    },
    statusDotInactive: {
        height: '10px',
        width: '10px',
        backgroundColor: '#888',
        borderRadius: '50%',
        display: 'inline-block',
        marginRight: '8px',
    },
    playerWrapper: {
        flex: 1,
        position: 'relative',
    },
    errorBanner: {
        position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 10,
        backgroundColor: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px',
        textAlign: 'center' as const,
    },
    statusOverlay: {
        position: 'absolute' as const, bottom: 0, left: 0, zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.6)', color: '#0f0', padding: '4px 10px', fontSize: '10px',
        borderRadius: '0 6px 0 0',
    },
    configContainer: {
        width: '100%',
        maxWidth: '1000px',
        margin: '1rem auto 0',
        backgroundColor: '#1c1c1c',
        borderRadius: '10px',
        border: '1px solid #444',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    },
    configHeader: {
        padding: '1rem',
        backgroundColor: '#282828',
        cursor: 'pointer',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '10px 10px 0 0',
    },
    configForm: {
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    configLabel: {
        marginTop: '10px',
        fontWeight: 'bold',
        color: '#ddd',
        fontSize: '0.9rem',
    },
    helpText: {
        fontSize: '0.75rem',
        color: '#aaa',
        marginBottom: '10px',
    },
    rtmpInputGroup: {
        display: 'flex',
        width: '100%',
    },
    rtmpDisplay: {
        flex: 1,
        fontFamily: 'monospace',
        backgroundColor: '#000',
        padding: '10px',
        borderRadius: '6px 0 0 6px',
        border: '1px solid #555',
        overflowX: 'auto',
        whiteSpace: 'nowrap' as const,
        color: '#ffdd00',
        borderRight: 'none',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem',
    },
    rtmpInstructions: {
        padding: '15px',
        backgroundColor: '#002244',
        border: '1px solid #0070f3',
        borderRadius: '6px',
        marginBottom: '20px',
    },
    securityWarning: {
        padding: '15px',
        backgroundColor: '#330000',
        border: '1px solid #ff4444',
        borderRadius: '6px',
        marginTop: '20px',
    },
};
