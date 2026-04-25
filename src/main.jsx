import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import DispatchRedesignMocks from './DispatchRedesignMocks.jsx'

const params = new URLSearchParams(window.location.search)
const showRedesignMocks = window.location.pathname === '/redesign-mocks' || params.get('mock') === 'redesign'
const Root = showRedesignMocks ? DispatchRedesignMocks : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
