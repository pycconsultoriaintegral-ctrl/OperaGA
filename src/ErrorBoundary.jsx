import { Component } from 'react';

/**
 * Red de seguridad: sin esto, cualquier error de JS durante el render (como
 * el `session is not defined` que dejó la app en blanco el 1 de sept. 2026)
 * hace que React desmonte todo el árbol sin ningún aviso — pantalla en
 * blanco, sin pista de qué pasó. Con esto al menos se ve un mensaje y un
 * botón para recargar, y el error queda en la consola para diagnosticarlo.
 */
export class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error('Error no capturado en OPERA:', error, info); }
  render(){
    if (!this.state.error) return this.props.children;
    return <div className="min-h-screen grid place-items-center bg-ink-50 px-6 text-center">
      <div className="max-w-sm">
        <p className="text-lg font-extrabold text-ink-900 mb-2">Algo salió mal</p>
        <p className="text-sm text-ink-500 mb-4">
          Hubo un error inesperado cargando la página. Intenta recargar — si sigue pasando, avísale a soporte.</p>
        <button onClick={()=>window.location.reload()}
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">
          Recargar
        </button>
      </div>
    </div>;
  }
}
