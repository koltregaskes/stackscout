let deferredInstallPrompt = null

async function registerStackScoutServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  const siteRoot = document.body?.dataset?.siteRoot || './'
  const scope = new URL(siteRoot, document.baseURI)

  try {
    await navigator.serviceWorker.register(new URL('service-worker.js', scope).href, {
      scope: scope.href,
    })
  } catch (error) {
    console.error('Stack Scout service worker registration failed.', error)
  }
}

function wireInstallButton() {
  const installButton = document.getElementById('installAppBtn')
  if (!installButton) {
    return
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
    installButton.hidden = false
  })

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      return
    }

    deferredInstallPrompt.prompt()
    await deferredInstallPrompt.userChoice
    deferredInstallPrompt = null
    installButton.hidden = true
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    installButton.hidden = true
  })
}

registerStackScoutServiceWorker()
wireInstallButton()
