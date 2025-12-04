"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// IMPORTANTE: A linha 'import MuxPlayer from "@mux/mux-player-react";' não é suportada 
// neste ambiente de ficheiro único React. Em vez disso, usamos o Mux Player Web Component (<mux-player>), 
// que é carregado dinamicamente no <head> para fornecer a mesma funcionalidade.

// --- CONFIGURAÇÕES E DADOS DE TESTE ---
// IDs de teste padrão (VOD Mux de demonstração)
const DEFAULT_PLAYBACK_ID_1 = 'kP5C71e800M2H35Hn7l77457Xy44600102Ld0234'; 
const DEFAULT_RTMP_KEY_1 = '8e2849be-3829-8a6b-2bc4-bce86a83bf62'; // Test key 1
const DEFAULT_PLAYBACK_ID_2 = 'kP5C71e800M2H35Hn7l77457Xy44600102Ld0235'; // Mock different ID
const DEFAULT_RTMP_KEY_2 = '8e2849be-3829-8a6b-2bc4-bce86a83bf63'; // Test key 2
const RTMP_BASE_URL = 'rtmp://global-live.mux.com:5222/app/';

// Definição dos drones configuráveis
const CONFIGURABLE_DRONES = [
    { id: 1, name: 'Drone Alpha (Principal)', configKey: 'drone1' as const },
    { id: 2, name: 'Drone Bravo (Secundário)', configKey: 'drone2' as const },
];

// Drones adicionais que foram removidos do display 'multi' conforme o seu pedido.
const ADDITIONAL_DRONES = [
    { id: 3, name: 'Drone Charlie (Monitoramento)' },
    { id: 4, name: 'Drone Delta (Reserva)' },
];

// Tipagem para configuração e utilizadores
interface SingleDroneConfig {
    playbackId: string;
    rtmpKey: string;
}

interface AllConfigs {
    drone1: SingleDroneConfig;
    drone2: SingleDroneConfig;
}

interface StoredUser {
    name: string;
    id: string;
}

type ViewMode = 'alpha' | 'bravo' | 'multi';

// Declaramos a interface para o componente web (para evitar erros TS)
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
const saveConfig = (config: AllConfigs) => {
    localStorage.setItem('droneConfigs', JSON.stringify(config));
};
const loadConfig = (): AllConfigs => {
    try {
        const savedConfig = localStorage.getItem('droneConfigs');
        if (savedConfig) {
            return JSON.parse(savedConfig) as AllConfigs;
        }
    } catch (e) {
        console.error("Erro ao carregar configuração:", e);
    }
    // Retorna a configuração padrão se falhar
    return {
        drone1: { playbackId: DEFAULT_PLAYBACK_ID_1, rtmpKey: DEFAULT_RTMP_KEY_1 },
        drone2: { playbackId: DEFAULT_PLAYBACK_ID_2, rtmpKey: DEFAULT_RTMP_KEY_2 },
    };
};

// --- COMPONENTES AUXILIARES ---

// Componente para copiar texto para a área de transferência
const CopyButton: React.FC<{ textToCopy: string, label: string }> = React.memo(({ textToCopy, label }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = textToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy'); 
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
});
CopyButton.displayName = 'CopyButton';

// Componente Player simplificado usando o Mux Web Component
const DroneStreamPlayer: React.FC<{ playbackId: string, droneName: string }> = React.memo(({ playbackId }) => {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={styles.statusOverlay}>
                Status: MuxPlayer pronto. (Playback ID: {playbackId.substring(0, 8)}...)
            </div>
            
            {/* @ts-ignore: O componente web mux-player não é reconhecido nativamente pelo JSX/TypeScript */}
            <mux-player
                playback-id={playbackId}
                stream-type="live" 
                style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                controls
                autoplay
                muted
            />
        </div>
    );
});
DroneStreamPlayer.displayName = 'DroneStreamPlayer';


// --- COMPONENTE PRINCIPAL ---
export default function DroneDashboard() {
    // --- ESTADOS ---
    const [username, setUsername] = useState('');
    const [user, setUser] = useState<StoredUser | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('alpha'); // Novo estado para controlar a visualização: 'alpha', 'bravo', 'multi'
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [config, setConfig] = useState<AllConfigs>(loadConfig());
    const [expandedConfig, setExpandedConfig] = useState<string | null>('drone1'); // Controla qual drone config está aberto

    // --- PERSISTÊNCIA & CARREGAMENTO DE SCRIPT ---
    useEffect(() => {
        // 1. Carrega o Mux Player Web Component Script
        if (typeof document !== 'undefined' && !document.querySelector('script[src*="mux-player"]')) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@mux/mux-player';
            script.async = true;
            document.head.appendChild(script);
        }

        // 2. Carrega o utilizador da sessão anterior
        setUser(loadUser());
        
        // 3. Carrega a configuração dos drones
        setConfig(loadConfig());
    }, []);

    // --- FUNÇÕES DE AUTENTICAÇÃO E CONFIGURAÇÃO ---
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        const uniqueId = `user-${Math.floor(Math.random() * 10000)}`;
        const loggedUser = { name: username, id: uniqueId };
        setUser(loggedUser);
        saveUser(loggedUser);
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
    };
    
    // Função para salvar uma única configuração de drone
    const handleSaveDroneConfig = (e: React.FormEvent, key: 'drone1' | 'drone2', tempPlaybackId: string, tempRtmpKey: string) => {
        e.preventDefault();
        const newConfig: SingleDroneConfig = {
            playbackId: tempPlaybackId.trim(),
            rtmpKey: tempRtmpKey.trim(),
        };
        
        setConfig(prev => {
            const updatedConfig = { ...prev, [key]: newConfig };
            saveConfig(updatedConfig);
            return updatedConfig;
        });
        
        // Fecha a seção de configuração após salvar
        setExpandedConfig(null);
    };


    // Mapeia todos os feeds ativos, incluindo os configuráveis (1 e 2) e os adicionais (3 e 4)
    const allFeeds = useMemo(() => {
        return [
            CONFIGURABLE_DRONES[0], // Drone Alpha (Configuração 1)
            CONFIGURABLE_DRONES[1], // Drone Bravo (Configuração 2)
            ...ADDITIONAL_DRONES // Outros drones que usavam a configuração do Drone 2
        ].map(drone => {
            let playbackId = config.drone2.playbackId; // Padrão para 3 e 4
            let isConfigurable = false;

            if (drone.id === 1) {
                playbackId = config.drone1.playbackId;
                isConfigurable = true;
            } else if (drone.id === 2) {
                playbackId = config.drone2.playbackId;
                isConfigurable = true;
            } else {
                // Drones 3 e 4 (Charlie e Delta) continuam usando a config do Drone 2 no back-end
                playbackId = config.drone2.playbackId; 
            }

            return {
                id: drone.id, 
                name: drone.name, 
                playbackId: playbackId,
                isConfigurable: isConfigurable,
            };
        });
    }, [config]);


    // Define quais feeds serão exibidos com base no viewMode
    const feedsToDisplay = useMemo(() => {
        const alphaDrone = allFeeds.find(d => d.id === 1);
        const bravoDrone = allFeeds.find(d => d.id === 2);
        
        switch (viewMode) {
            case 'alpha':
                return alphaDrone ? [alphaDrone] : [];
            case 'bravo':
                return bravoDrone ? [bravoDrone] : [];
            case 'multi':
                // **Ajuste solicitado:** Retorna apenas o Alpha (id: 1) e o Bravo (id: 2)
                return allFeeds.filter(d => d.id === 1 || d.id === 2);
            default:
                return alphaDrone ? [alphaDrone] : [];
        }
    }, [viewMode, allFeeds]);

    // --- RENDERIZAÇÃO: TELA DE CONFIGURAÇÃO (Sub-formulário para um Drone) ---
    const DroneConfigForm: React.FC<{ drone: typeof CONFIGURABLE_DRONES[0] }> = React.memo(({ drone }) => {
        // O TS exige a verificação de tipo ao acessar a chave dinâmica
        const key = drone.configKey as keyof AllConfigs;
        const currentConfig = config[key];
        
        const [tempPlaybackId, setTempPlaybackId] = useState(currentConfig.playbackId);
        const [tempRtmpKey, setTempRtmpKey] = useState(currentConfig.rtmpKey);

        // Atualiza os estados temporários se a configuração externa mudar
        useEffect(() => {
            setTempPlaybackId(currentConfig.playbackId);
            setTempRtmpKey(currentConfig.rtmpKey);
        }, [currentConfig.playbackId, currentConfig.rtmpKey]);

        const fullRtmpUrl = RTMP_BASE_URL + tempRtmpKey;
        const isExpanded = expandedConfig === drone.configKey;

        return (
            <div style={styles.configAccordionItem}>
                <div style={styles.configHeader} onClick={() => setExpandedConfig(isExpanded ? null : drone.configKey)}>
                    <h4 style={{ margin: 0 }}>
                        {isExpanded ? '➖' : '➕'} Configuração: {drone.name}
                    </h4>
                </div>
                {isExpanded && (
                    <form onSubmit={(e) => handleSaveDroneConfig(e, key, tempPlaybackId, tempRtmpKey)} style={styles.configForm}>

                        {/* --- Seção de Instruções de Transmissão RTMP --- */}
                        <div style={styles.rtmpInstructions}>
                            <h5>🚀 Instruções de Streaming para {drone.name}:</h5>
                            <p>Envie o vídeo usando a Chave de Stream abaixo.</p>
                        </div>
                        
                        {/* INPUT: CHAVE DE STREAM */}
                        <label style={styles.configLabel}>Chave de Stream (RTMP Key):</label>
                        <div style={styles.rtmpInputGroup}>
                            <input
                                type="text"
                                value={tempRtmpKey}
                                onChange={(e) => setTempRtmpKey(e.target.value)}
                                placeholder="Cole a Stream Key aqui"
                                style={styles.inputRtmp}
                                required
                            />
                            <CopyButton textToCopy={tempRtmpKey} label="Chave" />
                        </div>
                        <small style={styles.helpText}>Esta chave é usada para ENVIAR o vídeo para o Mux.</small>

                        {/* INPUT: URL RTMP COMPLETA */}
                        <label style={styles.configLabel}>URL RTMP Completa:</label>
                        <div style={styles.rtmpInputGroup}>
                            <div style={styles.rtmpDisplay}>
                                {fullRtmpUrl}
                            </div>
                            <CopyButton textToCopy={fullRtmpUrl} label="URL" />
                        </div>
                        
                        <hr style={{ border: 'none', borderBottom: '1px dashed #333', margin: '15px 0' }} />

                        {/* INPUT: ID DE REPRODUÇÃO */}
                        <label style={styles.configLabel}>ID de Reprodução (Mux Playback ID):</label>
                        <div style={styles.rtmpInputGroup}>
                            <input
                                type="text"
                                value={tempPlaybackId}
                                onChange={(e) => setTempPlaybackId(e.target.value)}
                                placeholder="Cole o Playback ID aqui"
                                style={styles.inputRtmp}
                                required
                            />
                            <CopyButton textToCopy={tempPlaybackId} label="ID" />
                        </div>
                        <small style={styles.helpText}>
                            Este ID é usado para RECEBER e reproduzir o vídeo.
                        </small>

                        <div style={styles.buttonGroup}>
                            <button type="submit" style={styles.buttonPrimary}>
                                Salvar {drone.name}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        );
    });
    DroneConfigForm.displayName = 'DroneConfigForm';

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
    

    return (
        <div style={styles.dashboardContainer}>
            {/* Cabeçalho */}
            <header style={styles.header}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Central de Comando de Drones</h2>
                    <small style={{ color: '#ccc', fontSize: '0.75rem' }}>
                        Operador: {user.name} | ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
                    </small>
                </div>
                <div style={styles.headerControls}>
                    
                    {/* Botões de Visualização */}
                    <button 
                        onClick={() => setViewMode('alpha')} 
                        style={viewMode === 'alpha' ? styles.buttonActive : styles.buttonSecondary}
                        title="Visualizar apenas o Drone Alpha (Principal)"
                    >
                        Drone 1 (Alpha)
                    </button>
                    <button 
                        onClick={() => setViewMode('bravo')} 
                        style={viewMode === 'bravo' ? styles.buttonActive : styles.buttonSecondary}
                        title="Visualizar apenas o Drone Bravo (Secundário)"
                    >
                        Drone 2 (Bravo)
                    </button>
                    <button 
                        onClick={() => setViewMode('multi')} 
                        style={viewMode === 'multi' ? styles.buttonActive : styles.buttonSecondary}
                        title="Visualizar Drone Alpha e Bravo simultaneamente"
                    >
                        Ambos (Grid)
                    </button>

                    {/* Botão de Configuração */}
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} style={styles.buttonSecondary}>
                        ⚙️ {isConfigOpen ? 'Fechar Config' : 'Configurar Streams'}
                    </button>

                    {/* Botão de Sair */}
                    <button onClick={handleLogout} style={styles.buttonDanger}>
                        Sair
                    </button>
                </div>
            </header>

            {/* Área de Configuração */}
            {isConfigOpen && (
                 <div style={styles.configContainer}>
                    <h3 style={styles.configTitle}>Configuração de Feeds de Transmissão</h3>
                    <p style={{...styles.helpText, padding: '0 1rem', margin: 0}}>Defina as chaves e IDs de reprodução para os drones Alpha e Bravo separadamente.</p>
                    
                    <div style={styles.configAccordion}>
                        {CONFIGURABLE_DRONES.map(drone => (
                            <DroneConfigForm key={drone.id} drone={drone} />
                        ))}
                    </div>
                    <div style={{...styles.buttonGroup, padding: '1rem', justifyContent: 'flex-start'}}>
                        <button onClick={() => setIsConfigOpen(false)} style={styles.buttonSecondary}>
                            Fechar Painel de Configuração
                        </button>
                    </div>
                </div>
            )}


            {/* Área de Vídeo */}
            <main style={styles.mainContent}>
                <div style={viewMode === 'multi' ? styles.gridContainer : styles.singleContainer}>

                    {feedsToDisplay.length > 0 ? (
                        feedsToDisplay.map((drone) => (
                            <div key={drone.id} style={styles.videoCard}>
                                <div style={styles.videoHeader}>
                                    {/* O statusDot usa uma cor simples para os drones configuráveis (1 e 2) */}
                                    <span style={drone.isConfigurable ? styles.statusDotActive : styles.statusDotInactive}></span>
                                    {drone.name}
                                </div>
                                <div style={styles.playerWrapper}>
                                    <DroneStreamPlayer
                                        playbackId={drone.playbackId}
                                        droneName={drone.name}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={styles.noFeedsMessage}>
                            <p>Nenhum drone selecionado para esta visualização.</p>
                            <p>Selecione um drone ou a opção "Ambos" no menu superior.</p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}

// --- ESTILOS (CSS-in-JS) ---
const styles: { [key: string]: React.CSSProperties } = {
    // Estilos de Login
    loginContainer: {
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '10px',
    },
    loginBox: {
        padding: '1.5rem',
        backgroundColor: '#222',
        borderRadius: '12px',
        border: '1px solid #333',
        textAlign: 'center' as const,
        width: '90%',
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
    
    // Estilos de Botões e Inputs
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
        minHeight: '44px',
    },
    buttonSecondary: {
        padding: '8px 12px',
        backgroundColor: '#333',
        color: 'white',
        border: '1px solid #555',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s, border-color 0.2s',
        minHeight: '40px',
    },
    buttonActive: {
        padding: '8px 12px',
        backgroundColor: '#0070f3',
        color: 'white',
        border: '1px solid #0050c3',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        minHeight: '40px',
        boxShadow: '0 0 8px rgba(0, 112, 243, 0.5)',
    },
    buttonDanger: {
        padding: '8px 12px',
        backgroundColor: '#e00',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        minHeight: '40px',
    },
    copyButton: {
        padding: '10px 15px',
        backgroundColor: '#0f0',
        color: '#111',
        border: 'none',
        borderRadius: '0 6px 6px 0',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.8rem',
        transition: 'background-color 0.2s',
        whiteSpace: 'nowrap' as const,
        minHeight: '40px',
    },
    
    // Estilos do Dashboard e Layout (Responsivos)
    dashboardContainer: {
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '1rem',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: '10px',
    },
    headerControls: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap' as const,
        justifyContent: 'flex-end',
    },
    mainContent: {
        flex: 1,
        padding: '10px',
        display: 'flex',
        justifyContent: 'center',
        overflowY: 'auto',
    },
    singleContainer: {
        width: '100%',
        maxWidth: '1000px',
        height: '80vh', // Aumentado para melhor visualização única
        display: 'flex',
        flexDirection: 'column',
    },
    gridContainer: {
        // Garantindo que, se forem apenas 2, eles fiquem lado a lado de forma responsiva
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '10px',
        width: '100%',
        minHeight: '80vh',
    },
    videoCard: {
        backgroundColor: '#000',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '2px solid #333',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '200px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
    },
    videoHeader: {
        padding: '0.5rem 0.75rem',
        backgroundColor: '#111',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem',
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
    statusOverlay: {
        position: 'absolute' as const, bottom: 0, left: 0, zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.6)', color: '#0f0', padding: '4px 10px', fontSize: '10px',
        borderRadius: '0 6px 0 0',
    },
    noFeedsMessage: {
        padding: '2rem',
        textAlign: 'center' as const,
        backgroundColor: '#1c1c1c',
        borderRadius: '10px',
        border: '1px solid #444',
        margin: 'auto',
        maxWidth: '400px',
        height: 'fit-content',
    },
    
    // Estilos de Configuração
    configContainer: {
        width: '90%',
        maxWidth: '1000px',
        margin: '1rem auto 0',
        backgroundColor: '#1c1c1c',
        borderRadius: '10px',
        border: '1px solid #444',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
        padding: '1rem 0', 
    },
    configTitle: {
        margin: '0 1rem 0.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid #333',
    },
    configAccordion: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '0 1rem',
    },
    configAccordionItem: {
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    configHeader: {
        padding: '0.8rem',
        backgroundColor: '#282828',
        cursor: 'pointer',
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'background-color 0.2s',
    },
    configForm: {
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        borderTop: '1px solid #333',
        backgroundColor: '#222',
    },
    configLabel: {
        marginTop: '5px',
        fontWeight: 'bold',
        color: '#ddd',
        fontSize: '0.9rem',
    },
    helpText: {
        fontSize: '0.7rem',
        color: '#aaa',
    },
    rtmpInputGroup: {
        display: 'flex',
        width: '100%',
    },
    inputRtmp: {
        flex: 1,
        padding: '10px',
        borderRadius: '6px 0 0 6px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '0.9rem',
        minWidth: '100px',
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
        fontSize: '0.8rem',
    },
    rtmpInstructions: {
        padding: '10px',
        backgroundColor: '#002244',
        border: '1px solid #0070f3',
        borderRadius: '6px',
        marginBottom: '10px',
    },
    buttonGroup: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '10px',
        flexWrap: 'wrap' as const,
    }
};
