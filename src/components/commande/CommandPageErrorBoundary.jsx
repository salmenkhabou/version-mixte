import { Component } from 'react'

class CommandPageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Command page error boundary caught an error', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  handleReload = () => {
    globalThis.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const interfaceLabel = this.props.interfaceType === 'manager' ? 'manager' : 'staff'

    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-6'>
        <div className='max-w-xl w-full border border-red-500/30 bg-white/5 p-8 text-center'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-4'>Commande {interfaceLabel}</p>
          <h1 className='text-3xl sm:text-4xl font-light mb-4'>Une erreur est survenue</h1>
          <p className='text-white/70 mb-6'>
            La page commande a rencontre un probleme inattendu. Vous pouvez reessayer ou recharger la page.
          </p>
          <p className='text-white/40 text-sm break-words mb-8'>{this.state.errorMessage}</p>
          <div className='flex flex-col sm:flex-row gap-3 justify-center'>
            <button
              type='button'
              onClick={this.handleRetry}
              className='px-4 py-2 border border-white/30 text-white uppercase tracking-wider text-xs hover:bg-white/10 transition'
            >
              Reessayer
            </button>
            <button
              type='button'
              onClick={this.handleReload}
              className='px-4 py-2 border border-red-400/40 text-red-200 uppercase tracking-wider text-xs hover:bg-red-500/10 transition'
            >
              Recharger
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default CommandPageErrorBoundary
