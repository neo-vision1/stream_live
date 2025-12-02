"use client"; // Necessário para usar useState e interações no Next.js App Router

import React, { useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';

// Simulação de IDs de diferentes drones. 
// Na vida real, viriam do seu banco de dados.
const DRONE_FEEDS = [
  { id: 1, name: 'Drone Alpha (Principal)', playbackId: 'ce55dde1-771b-4583-8a0c-9501d5cbe8d9' },
  { id: 2, name: 'Drone Bravo', playbackId: 'ce55dde1-771b-4583-8a0c-9501d5cbe8d9' }, // Repetido para teste
  { id: 3, name: 'Drone Charlie', playbackId: 'ce55dde1-771b-4583-8a0c-9501d5cbe8d9' }, // Repetido para teste
  { id: 4, name: 'Drone Delta', playbackId: 'ce55dde1-771b-4583-8a0c-9501d5cbe8d9' }, // Repetido para teste
];

export default function DroneDashboard() {
  // --- ESTADOS ---
  const [username, setUsername] = useState('');
  const [user, setUser] = useState<{ name: string; id: string } | null>(null);
  const [isMultiView, setIsMultiView] = useState(false);

  // --- FUNÇÕES ---
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    // Gera um ID único simples para a sessão (ex: user-9382)
    const uniqueId = `user-${Math.floor(Math.random() * 10000)}`;
    setUser({ name: username, id: uniqueId });
  };

  const toggleView = () => setIsMultiView(!isMultiView);

  // --- RENDERIZAÇÃO: TELA DE LOGIN ---
  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginBox}>
          <h1 style={{ marginBottom: '1rem' }}>Acesso Restrito</h1>
          <form onSubmit={handleLogin} style={styles.form}>
            <input
              type="text"
              placeholder="Digite seu nome de operador"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.buttonPrimary}>
              Entrar no Sistema
            </button>
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
          <h2 style={{ margin: 0 }}>Central de Comando</h2>
          <small style={{ color: '#ccc' }}>
            Operador: {user.name} | ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
          </small>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={toggleView} style={styles.buttonSecondary}>
            {isMultiView ? '👁️ Ver Único' : '🎥 Ver Múltiplos (Grid)'}
          </button>
          <button onClick={() => setUser(null)} style={styles.buttonDanger}>
            Sair
          </button>
        </div>
      </header>

      {/* Área de Vídeo */}
      <main style={styles.mainContent}>
        <div style={isMultiView ? styles.gridContainer : styles.singleContainer}>
          
          {/* Lógica: Se for MultiView mostra todos, se não, mostra só o primeiro */}
          {(isMultiView ? DRONE_FEEDS : [DRONE_FEEDS[0]]).map((drone) => (
            <div key={drone.id} style={styles.videoCard}>
              <div style={styles.videoHeader}>
                <span style={styles.statusDot}></span> {drone.name}
              </div>
              <div style={styles.playerWrapper}>
                <MuxPlayer
                  streamType="live"
                  playbackId={drone.playbackId}
                  metadata={{
                    video_id: `drone-${drone.id}`,
                    video_title: drone.name,
                    viewer_user_id: user.id, // O ID único gerado no login
                  }}
                  style={{ height: '100%', width: '100%' }}
                  autoPlay
                  muted
                />
              </div>
            </div>
          ))}

        </div>
      </main>
    </div>
  );
}

// --- ESTILOS (CSS-in-JS simples para facilitar o copy-paste) ---
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
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '1rem',
  },
  buttonPrimary: {
    padding: '10px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  buttonDanger: {
    padding: '8px 16px',
    backgroundColor: '#e00',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
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
  statusDot: {
    height: '10px',
    width: '10px',
    backgroundColor: '#0f0',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '8px',
    boxShadow: '0 0 5px #0f0',
  },
  playerWrapper: {
    flex: 1,
    position: 'relative',
  },
};