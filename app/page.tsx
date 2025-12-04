"use client";

import React, { useState, useEffect } from 'react';

// --- CONFIGURAÇÕES E DADOS DE TESTE ---
// Playback ID de teste padrão (você deve substituir este pelo seu ID real)
const DEFAULT_PLAYBACK_ID = 'W72UFolv01VI00hiyh004TLbxVO300Osr300901Kp84HXGfBE'; 
const DEFAULT_RTMP_KEY = '8e2849be-3829-8a6b-2bc4-bce86a83bf62';
const RTMP_BASE_URL = 'rtmp://global-live.mux.com:5222/app/';

// Simulação de feeds de drones secundários.
const SECONDARY_DRONES = [
  { id: 2, name: 'Drone Bravo (Secundário)', playbackId: DEFAULT_PLAYBACK_ID },
  { id: 3, name: 'Drone Charlie (Monitoramento)', playbackId: DEFAULT_PLAYBACK_ID },
  { id: 4, name: 'Drone Delta (Reserva)', playbackId: DEFAULT_PLAYBACK_ID },
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

// --- FUNÇÕES DE ARMAZENAMENTO SIMPLES (USANDO LOCALSTORAGE PARA PERSISTÊNCIA) ---
// O localStorage é usado para manter a sessão do utilizador e as configurações do drone
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

// Componente Player customizado para usar a tag <video> nativa (Substitui MuxPlayer)
const DroneStreamPlayer: React.FC<{ playbackId: string, droneName: string, userId: string }> = ({ playbackId }) => {
    // Constrói o URL de stream HLS (.m3u8) usando o Playback ID
    // O Mux entrega o stream ao vivo neste formato
    const MUX_HLS_URL = `https://stream.mux.com/${playbackId}.m3u8`;

    return (
        <video 
            // Atributos de reprodução e estilo
            src={MUX_HLS_URL}
            controls
            autoPlay
            muted
            // Importante para garantir que o vídeo preencha o container
            style={{ height: '100%', width: '100%', objectFit: 'cover' }}
        >
            {/* O tipo é essencial para que o browser saiba como lidar com o stream HLS */}
            <source src={MUX_HLS_URL} type="application/vnd.apple.mpegurl" />
            O seu navegador não suporta a tag de vídeo. Verifique se o Playback ID está correto.
        </video>
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

  // --- PERSISTÊNCIA (CARREGAR ESTADOS INICIAIS) ---
  useEffect(() => {
    // Carrega o utilizador da sessão anterior
    setUser(loadUser());
    
    // Carrega a configuração do drone (IDs)
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

            <div style={styles.securityWarning}>
                <h4>AVISO: O MuxPlayer foi substituído!</h4>
                {/* CORREÇÃO: Substituí os caracteres de tag HTML '<' e '>' por entidades para evitar erros de parsing JSX */}
                <p>Devido a restrições de importação neste ambiente, estamos a usar o player HTML <code>&lt;video&gt;</code> nativo, que carrega o URL HLS (<code>.m3u8</code>).</p>
            </div>
            
            <label style={styles.configLabel}>ID de Reprodução (Mux Playback ID):</label>
            <input
              type="text"
              value={tempPlaybackId}
              onChange={(e) => setTempPlaybackId(e.target.value)}
              placeholder="Cole o Playback ID aqui (Ex: ce55dde1...)"
              style={styles.input}
              required
            />
            <small style={styles.helpText}>Este ID é usado no player para ASSISTIR ao vídeo.</small>

            <label style={styles.configLabel}>Chave de Stream (RTMP Key):</label>
            <input
              type="text"
              value={tempRtmpKey}
              onChange={(e) => setTempRtmpKey(e.target.value)}
              placeholder="Cole a Stream Key aqui (Ex: sua_chave_de_stream_mux)"
              style={styles.input}
              required
            />
            <small style={styles.helpText}>Esta chave é usada no Drone para ENVIAR o vídeo para o Mux.</small>

            <label style={styles.configLabel}>URL RTMP Completa para o Drone:</label>
            <div style={styles.rtmpDisplay}>
                {fullRtmpUrl}
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
                  userId={user.id}
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
    fontFamily: 'sans-serif',
  },
  loginBox: {
    padding: '2rem',
    backgroundColor: '#222',
    borderRadius: '8px',
    border: '1px solid #333',
    textAlign: 'center' as const,
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '1rem',
  },
  buttonPrimary: {
    padding: '12px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    marginTop: '0.5rem',
  },
  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDanger: {
    padding: '8px 16px',
    backgroundColor: '#e00',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  dashboardContainer: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontFamily: 'sans-serif',
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
    padding: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  singleContainer: {
    width: '100%',
    maxWidth: '1000px',
    height: '600px',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1.5rem',
    width: '100%',
  },
  videoCard: {
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '300px',
  },
  videoHeader: {
    padding: '0.5rem 1rem',
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
  configContainer: {
    width: '100%',
    maxWidth: '1000px',
    margin: '1rem auto 0',
    backgroundColor: '#1c1c1c',
    borderRadius: '8px',
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
  },
  configForm: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  configLabel: {
    marginTop: '5px',
    fontWeight: 'bold',
    color: '#ddd',
  },
  helpText: {
    fontSize: '0.75rem',
    color: '#aaa',
    marginBottom: '10px',
  },
  rtmpDisplay: {
    fontFamily: 'monospace',
    backgroundColor: '#000',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #555',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    color: '#0f0',
  },
  securityWarning: {
    padding: '15px',
    backgroundColor: '#330000',
    border: '1px solid #ff4444',
    borderRadius: '6px',
    marginBottom: '20px',
  },
};
