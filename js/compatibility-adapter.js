  // Adaptateur de compatibilité pour l'API Electron
  console.log('Chargement de compatibility-adapter.js...');

  // Fonction d'initialisation à appeler une fois que electronAPI est disponible
  function initCompatibilityAdapter() {
      if (!window.electronAPI) {
          console.warn('electronAPI non disponible, adaptateur de compatibilité limité');
          return false;
      }

      // Exposer les anciens objets fs et path pour la compatibilité temporaire
      if (!window.fs && window.electronAPI.file) {
          window.fs = {
              existsSync: window.electronAPI.file.exists,
              readFileSync: (path, encoding) => {
                  try {
                      return window.electronAPI.file.readFile(path);
                  } catch (error) {
                      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
                  }
              },
              writeFileSync: (path, data, encoding) => {
                  try {
                      return window.electronAPI.file.writeFile(path, data);
                  } catch (error) {
                      throw new Error(`Error writing file '${path}': ${error.message}`);
                  }
              },
              mkdirSync: (path, options) => {
                  try {
                      return window.electronAPI.file.mkdir(path);
                  } catch (error) {
                      if (options && options.recursive) {
                          return window.electronAPI.file.mkdir(path);
                      }
                      throw error;
                  }
              },
              readdirSync: window.electronAPI.file.readdir,
              statSync: window.electronAPI.file.stat,
              copyFileSync: window.electronAPI.file.copyFile,
              unlinkSync: window.electronAPI.file.unlink,
              renameSync: window.electronAPI.file.rename
          };
          console.log('Adaptateur fs créé');
      }

      if (!window.path && window.electronAPI.path) {
          window.path = {
              join: window.electronAPI.path.join,
              resolve: window.electronAPI.path.resolve,
              dirname: window.electronAPI.path.dirname,
              basename: window.electronAPI.path.basename,
              extname: window.electronAPI.path.extname,
              parse: window.electronAPI.path.parse,
              format: window.electronAPI.path.format,
              sep: window.electronAPI.path.sep
          };
          console.log('Adaptateur path créé');
      }

      // Créer un faux objet ipcRenderer pour la compatibilité
      if (!window.ipcRenderer && window.electronAPI.ipc) {
          window.ipcRenderer = {
              send: window.electronAPI.ipc.send,
              invoke: window.electronAPI.ipc.invoke,
              on: window.electronAPI.ipc.on,
              removeAllListeners: window.electronAPI.ipc.removeAllListeners
          };
          console.log('Adaptateur ipcRenderer créé');
      }

      console.log('Adaptateur de compatibilité initialisé avec succès');
      return true;
  }

  // Essayer d'initialiser immédiatement si electronAPI est déjà disponible
  if (window.electronAPI) {
      initCompatibilityAdapter();
  } else {
      // Sinon, attendre que electronAPI soit disponible
      let attempts = 0;
      const maxAttempts = 50; // 5 secondes max
      const waitForElectronAPI = setInterval(() => {
          attempts++;
          if (window.electronAPI) {
              clearInterval(waitForElectronAPI);
              initCompatibilityAdapter();
          } else if (attempts >= maxAttempts) {
              clearInterval(waitForElectronAPI);
              console.warn('electronAPI non disponible après 5 secondes, adaptateur de compatibilité non initialisé');
          }
      }, 100);
  }

  // Exposer la fonction d'initialisation pour un appel manuel si nécessaire
  window.initCompatibilityAdapter = initCompatibilityAdapter;