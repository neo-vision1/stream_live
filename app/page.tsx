import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, 
    addDoc, serverTimestamp, doc, deleteDoc 
} from 'firebase/firestore';

// --- CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE ---
// Variáveis globais fornecidas pelo ambiente
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializa o Firebase
const app = firebaseConfig && Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// Função auxiliar para converter o timestamp do Firestore
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Aguardando...';
    return timestamp.toDate().toLocaleString('pt-BR', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
};

// Componente Principal
const App = () => {
    // Estado para a lista de eventos da Linha do Tempo
    const [events, setEvents] = useState([]);
    // Estado para o texto do novo evento a ser adicionado
    const [newEventText, setNewEventText] = useState('');
    // Estados do Firebase
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Efeito para Inicialização da Autenticação
    useEffect(() => {
        if (!auth) {
            setError("Configuração do Firebase ausente.");
            setIsAuthReady(true);
            setIsLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                // Tenta autenticar com token customizado (se fornecido)
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        // Caso contrário, usa autenticação anônima
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Falha na autenticação:", e);
                    // Se falhar, usa um UUID temporário, mas as regras de segurança podem bloquear o Firestore
                    setUserId(crypto.randomUUID()); 
                }
            }
            setIsAuthReady(true);
            // O loading só termina após a primeira checagem de auth
            if (isLoading) setIsLoading(false); 
        });

        return () => unsubscribe();
    }, []);

    // 2. Efeito para Escuta em Tempo Real (onSnapshot) dos Eventos
    useEffect(() => {
        // Garantir que a autenticação está pronta e o DB inicializado
        if (!isAuthReady || !userId || !db) return;

        setIsLoading(true);
        setError(null);

        // Caminho da coleção de dados privados: /artifacts/{appId}/users/{userId}/timeline_events
        const timelineCollectionPath = `artifacts/${appId}/users/${userId}/timeline_events`;
        const q = query(collection(db, timelineCollectionPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Ordenar por data (mais recente primeiro)
            fetchedEvents.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            
            setEvents(fetchedEvents);
            setIsLoading(false);
        }, (err) => {
            console.error("Erro ao carregar dados da Linha do Tempo:", err);
            setError(`Falha ao carregar eventos: ${err.message}. Verifique as regras de segurança.`);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, userId, db]); // Depende do estado de autenticação e dos objetos Firebase

    // Função para adicionar um novo evento à Linha do Tempo
    const addEvent = async (e) => {
        e.preventDefault();
        if (!newEventText.trim() || !userId || !db) return;

        const timelineCollectionPath = `artifacts/${appId}/users/${userId}/timeline_events`;

        try {
            await addDoc(collection(db, timelineCollectionPath), {
                text: newEventText.trim(),
                createdAt: serverTimestamp(),
            });
            setNewEventText('');
        } catch (error) {
            console.error("Erro ao adicionar evento:", error);
            setError("Não foi possível adicionar o evento. Tente novamente.");
        }
    };

    // Função para deletar um evento
    const deleteEvent = async (id) => {
        if (!userId || !db) return;

        const timelineDocPath = `artifacts/${appId}/users/${userId}/timeline_events/${id}`;

        try {
            await deleteDoc(doc(db, timelineDocPath));
        } catch (error) {
            console.error("Erro ao deletar evento:", error);
            setError("Não foi possível deletar o evento.");
        }
    };
    
    // UI Render
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="text-center mb-10 p-4 bg-white shadow-lg rounded-xl">
                    <h1 className="text-4xl font-extrabold text-indigo-700 tracking-tight mb-2">
                        Linha do Tempo de Eventos
                    </h1>
                    <p className="text-gray-600">
                        Seu diário de eventos persistente. Usando Firebase Firestore para sincronização em tempo real.
                    </p>
                    <div className="mt-2 text-xs text-gray-500">
                        <span className="font-semibold">ID do Usuário:</span> <code className="bg-gray-100 p-1 rounded text-pink-500">{userId || 'Autenticando...'}</code>
                    </div>
                </header>

                {/* Formulário para Adicionar Novo Evento */}
                <form onSubmit={addEvent} className="mb-8 p-6 bg-white rounded-xl shadow-lg border border-indigo-200">
                    <h2 className="text-xl font-semibold text-gray-700 mb-4">Adicionar Novo Evento</h2>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <input
                            type="text"
                            value={newEventText}
                            onChange={(e) => setNewEventText(e.target.value)}
                            placeholder="Descreva o evento (ex: Lançamento do Produto Alfa)"
                            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            disabled={!isAuthReady}
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-[1.02] disabled:opacity-50"
                            disabled={!newEventText.trim() || !isAuthReady || isLoading}
                        >
                            {isLoading ? 'Carregando...' : 'Adicionar Evento'}
                        </button>
                    </div>
                </form>

                {/* Feedback e Status */}
                {error && (
                    <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
                        <p className="font-bold">Erro de Dados:</p>
                        <p>{error}</p>
                    </div>
                )}

                {isLoading && (
                    <div className="text-center p-8 text-indigo-500 font-medium">
                        <div className="animate-spin inline-block w-6 h-6 border-4 border-t-transparent border-indigo-500 rounded-full mr-3"></div>
                        Carregando eventos da Linha do Tempo...
                    </div>
                )}

                {/* Visualização da Linha do Tempo */}
                <div className="relative border-l-4 border-indigo-300 ml-4 pl-4 space-y-8">
                    {!isLoading && events.length === 0 && (
                         <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-300 text-center text-gray-500">
                            Nenhum evento na linha do tempo ainda. Adicione o primeiro!
                        </div>
                    )}

                    {events.map((event, index) => (
                        <div 
                            key={event.id} 
                            className="relative mb-6 p-5 bg-white rounded-xl shadow-2xl transition duration-300 ease-in-out hover:shadow-indigo-300/50 group"
                        >
                            {/* Ponto da Linha do Tempo */}
                            <div className="absolute -left-7 top-0 w-4 h-4 bg-indigo-600 rounded-full border-4 border-white transform translate-x-1/2 group-hover:bg-pink-500 transition"></div>
                            
                            <div className="flex justify-between items-start">
                                <p className="text-lg font-semibold text-gray-800 break-words pr-10">
                                    {event.text}
                                </p>
                                <button
                                    onClick={() => deleteEvent(event.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full absolute top-2 right-2"
                                    aria-label="Deletar Evento"
                                >
                                    {/* Icone SVG de Lixeira */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011 1v6a1 1 0 11-2 0V9a1 1 0 011-1zm7 1a1 1 0 00-2 0v6a1 1 0 102 0V9z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            
                            <p className="mt-2 text-sm text-indigo-500 font-medium">
                                {formatTimestamp(event.createdAt)}
                            </p>
                        </div>
                    ))}
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
