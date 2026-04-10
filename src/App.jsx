import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Component from './compoents/CoffeeShop'
import Loader from './compoents/Loader'

function App() {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)

  const handleLoadComplete = () => {
    // Immediate transition
    setIsLoading(false)
    setShowContent(true)
  }

  return (
    <>
      {/* Loader with instant fade out */}
      <div className={`transition-opacity duration-150 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isLoading && <Loader onLoadComplete={handleLoadComplete} />}
      </div>
      
      {/* Main content appears instantly */}
      <div className={`${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {showContent && <Component />}
      </div>
    </>
  )
}

export default App
