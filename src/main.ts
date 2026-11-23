import './app.css'
import { mount } from 'svelte'
import Root from './Root.svelte'

const prerender = document.getElementById('seo-prerender')
if (prerender && !isAppPath()) prerender.style.display = 'none'

mount(Root, {
  target: document.getElementById('app')!,
})

function isAppPath() {
  const p = location.pathname.replace(/\/$/, '') || '/'
  return p === '/'
}

export default undefined