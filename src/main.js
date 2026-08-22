import './style.css';
import { read, utils, writeFile } from 'xlsx';

document.addEventListener('DOMContentLoaded', () => {
  // --- API Configuration ---
  const API_BASE = '/api';
  const PUBLIC_URL_BASE = window.location.origin;

  // --- Password Validation Helper ---
  function validatePasswordRules(password) {
    if (!password) return "Le mot de passe est obligatoire.";
    const errors = [];
    if (password.length < 8) {
      errors.push("au moins 8 caractères");
    }
    if (!/[a-zA-Z]/.test(password)) {
      errors.push("au moins une lettre");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("au moins un chiffre");
    }
    if (errors.length > 0) {
      if (errors.length === 1) {
        return `Le mot de passe doit contenir ${errors[0]}.`;
      }
      return `Le mot de passe n'est pas valide. Critères manquants : ${errors.join(', ')}.`;
    }
    return null;
  }

  // --- Password Toggle Eye Icon Helper ---
  function setupPasswordToggles() {
    const passwordInputs = document.querySelectorAll('input[type="password"], input[data-password-toggle="true"]');
    passwordInputs.forEach((input) => {
      const wrapper = input.parentElement;
      if (!wrapper || !wrapper.classList.contains('input-wrapper')) return;
      if (wrapper.querySelector('.btn-toggle-password')) return;

      wrapper.classList.add('has-password-toggle');
      input.setAttribute('data-password-toggle', 'true');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-toggle-password';
      btn.setAttribute('aria-label', 'Afficher le mot de passe');
      btn.tabIndex = -1;
      btn.innerHTML = `
        <svg class="icon-eye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="icon-eye-off hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        const eyeOn = btn.querySelector('.icon-eye');
        const eyeOff = btn.querySelector('.icon-eye-off');
        if (isPassword) {
          eyeOn.classList.add('hidden');
          eyeOff.classList.remove('hidden');
        } else {
          eyeOn.classList.remove('hidden');
          eyeOff.classList.add('hidden');
        }
      });

      wrapper.appendChild(btn);
    });
  }

  // --- Authentication State & Fetch Wrapper ---
  let authToken = localStorage.getItem('tdconnect_token') || '';
  let currentUser = JSON.parse(localStorage.getItem('tdconnect_user')) || null;

  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
      logoutUser();
      showLoginModal();
      throw new Error("Session expirée ou invalide. Veuillez vous reconnecter.");
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error("Le serveur API (port 3000) n'a pas renvoyé une réponse JSON valide. Assurez-vous que le backend est démarré.");
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur serveur (${res.status})`);
    }
    return res;
  }

  // Fetch Server Network IP to construct local network URLs for QR codes
  let serverLocalIP = '';
  async function fetchServerNetworkIP() {
    try {
      const res = await apiFetch(`${API_BASE}/network-ip`);
      const data = await res.json();
      if (data && data.ip) {
        serverLocalIP = data.ip;
        console.log("Adresse IP réseau local du serveur résolue :", serverLocalIP);
      }
    } catch (err) {
      console.warn("Impossible de résoudre l'adresse IP réseau du serveur :", err);
    }
  }
  fetchServerNetworkIP();

  // --- DOM Element References ---
  
  // Views
  const viewLanding = document.getElementById('view-landing');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewCompaniesList = document.getElementById('view-companies-list');
  const viewCompanyDetail = document.getElementById('view-company-detail');
  const viewAdminPanel = document.getElementById('view-admin-panel');
  const viewRegister = document.getElementById('view-register');

  const mainContent = document.querySelector('.main-content');
  function updateLayoutMode() {
    if (!mainContent) return;
    const isDetailVisible = viewCompanyDetail && !viewCompanyDetail.classList.contains('hidden');
    if (isDetailVisible) {
      mainContent.classList.add('detail-mode');
    } else {
      mainContent.classList.remove('detail-mode');
    }
  }

  // Navigation & Landing Elements
  const navLogo = document.getElementById('nav-logo');
  const btnNavHome = document.getElementById('btn-nav-home');
  const btnNavDashboard = document.getElementById('btn-nav-dashboard');
  const btnLoginToggle = document.getElementById('btn-login-toggle');
  const btnLoginText = document.getElementById('btn-login-text');
  const iconLogin = btnLoginToggle ? btnLoginToggle.querySelector('.icon-login') : null;
  const iconLogout = btnLoginToggle ? btnLoginToggle.querySelector('.icon-logout') : null;
  const btnCtaStart = document.getElementById('btn-cta-start');
  const searchCompany = document.getElementById('search-company');
  const searchCollab = document.getElementById('search-collab');
  const btnExcelExport = document.getElementById('btn-excel-export');
  const btnExcelImport = document.getElementById('btn-excel-import');
  const excelImportFile = document.getElementById('excel-import-file');
  
  // View A (Companies List)
  const btnAddCompanyShow = document.getElementById('btn-add-company-show');
  const btnAdminPanelShow = document.getElementById('btn-admin-panel-show');
  const companiesGrid = document.getElementById('companies-grid');
  const companyAddFormContainer = document.getElementById('company-add-form-container');
  const newCompanyNameInput = document.getElementById('new-company-name');
  const newCompanyDomainInput = document.getElementById('new-company-domain');
  const newCompanySubscriptionEndInput = document.getElementById('new-company-subscription-end');
  const btnSaveNewCompany = document.getElementById('btn-save-new-company');
  const btnCancelNewCompany = document.getElementById('btn-cancel-new-company');
  
  // View B (Company Detail & Collaborators)
  const btnBackToList = document.getElementById('btn-back-to-list');
  const activeCompanyTitle = document.getElementById('active-company-title');
  const companyNameInput = document.getElementById('company-name');
  const companyDomainInput = document.getElementById('company-domain');
  const companyAddressInput = document.getElementById('company-address');
  const companyZipInput = document.getElementById('company-zip');
  const companyCityInput = document.getElementById('company-city');
  const companyCountryInput = document.getElementById('company-country');
  const companySubscriptionEndInput = document.getElementById('company-subscription-end');
  const companyIsSubscriptionActiveInput = document.getElementById('company-is-subscription-active');
  const companyLogoSizeInput = document.getElementById('company-logo-size');
  const companyLogoSizeVal = document.getElementById('company-logo-size-val');
  const companyLogoXInput = document.getElementById('company-logo-x');
  const companyLogoXVal = document.getElementById('company-logo-x-val');
  const companyShowNameInput = document.getElementById('company-show-name');
  const companyShowMessageInput = document.getElementById('company-show-message');
  const companyMessageTextInput = document.getElementById('company-message-text');
  const companyMessageUrlInput = document.getElementById('company-message-url');
  const companyMessageContainer = document.getElementById('company-message-container');
  
  const cardElement = document.getElementById('virtual-card-preview');
  const cardLogo = document.getElementById('prev-company-logo');
  const prevCompanyLogoLink = document.getElementById('prev-company-logo-link');
  const prevCompanyNameUnderLogo = document.getElementById('prev-company-name-under-logo');
  const prevCompanyMessageUnderFooter = document.getElementById('prev-company-message-under-footer');
  
  const btnFetchLogo = document.getElementById('btn-fetch-logo');
  const dropZone = document.getElementById('drop-zone');
  const logoFileInput = document.getElementById('logo-file');
  const logoPreviewThumb = document.getElementById('logo-preview-thumb');
  const thumbImg = document.getElementById('thumb-img');
  const btnRemoveLogo = document.getElementById('btn-remove-logo');
  
  const themeRadios = document.getElementsByName('card-theme');
  const fontButtons = document.querySelectorAll('.btn-font');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorInput = document.getElementById('custom-color');
  const companyBtnStyleRadios = document.getElementsByName('company-btn-style');
  
  // Collaborators Tab Elements
  const btnAddCollab = document.getElementById('btn-add-collab');
  const collabListContainer = document.getElementById('collab-list');
  const collabFormContainer = document.getElementById('collab-form-container');
  const collabForm = document.getElementById('collab-form');
  const collabFormTitle = document.getElementById('collab-form-title');
  
  const collabIdInput = document.getElementById('collab-id');
  const collabDisplayIdInput = document.getElementById('collab-display-id');
  const collabFirstnameInput = document.getElementById('collab-firstname');
  const collabLastnameInput = document.getElementById('collab-lastname');
  const collabTitleInput = document.getElementById('collab-title');
  const collabRoleInput = document.getElementById('collab-role');
  const collabPhoneInput = document.getElementById('collab-phone');
  const collabPhoneMobileInput = document.getElementById('collab-phone-mobile');
  const collabPhoneWorkInput = document.getElementById('collab-phone-work');
  const collabPhoneFaxInput = document.getElementById('collab-phone-fax');
  const collabPhoneDefaultInput = document.getElementById('collab-phone-default');
  const collabEmailInput = document.getElementById('collab-email');
  const collabAddressInput = document.getElementById('collab-address');
  const collabPhotoClickUrlInput = document.getElementById('collab-photo-click-url');
  const collabActiveToggle = document.getElementById('collab-active-toggle');
  const collabActiveLabel = document.getElementById('collab-active-label');
  const collabCustomSlugInput = document.getElementById('collab-custom-slug');
  const collabCustomSlugGroup = document.getElementById('collab-custom-slug-group');
  const collabSlugWarning = document.getElementById('collab-slug-warning');
  const collabConnectionCountInput = document.getElementById('collab-connection-count');
  const collabConnectionCountGroup = document.getElementById('collab-connection-count-group');
  const collabConnectionCounterDisplay = document.getElementById('collab-connection-counter-display');
  const collabConnectionCountBadge = document.getElementById('collab-connection-count-badge');
  const collabExportZipContainer = document.getElementById('collab-export-zip-container');

  // Collaborator Profile Photo Upload
  const collabPhotoZone = document.getElementById('collab-photo-zone');
  const collabPhotoFileInput = document.getElementById('collab-photo-file');
  const collabPhotoThumb = document.getElementById('collab-photo-thumb');
  const collabThumbImg = document.getElementById('collab-thumb-img');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  
  const btnSaveCollab = document.getElementById('btn-save-collab');
  const btnCancelCollab = document.getElementById('btn-cancel-collab');

  // Photo Framing Sliders
  const photoFramingControls = document.getElementById('photo-framing-controls');
  const collabPhotoZoomInput = document.getElementById('collab-photo-zoom');
  const collabPhotoXInput = document.getElementById('collab-photo-x');
  const collabPhotoYInput = document.getElementById('collab-photo-y');
  const companyAvatarSizeInput = document.getElementById('company-avatar-size');
  const companyAvatarSizeVal = document.getElementById('company-avatar-size-val');

  // Smartphone Preview Elements
  const previewPlaceholderMsg = document.getElementById('preview-placeholder-msg');
  const previewCollabContent = document.getElementById('preview-collab-content');
  const prevCollabName = document.getElementById('prev-collab-name');
  const prevCollabRole = document.getElementById('prev-collab-role');
  const prevAvatarInitials = document.getElementById('prev-avatar-initials');
  const prevAvatarWrapper = document.getElementById('prev-avatar-wrapper');
  const prevAvatarImg = document.getElementById('prev-avatar-img');
  const prevAvatarLink = document.getElementById('prev-avatar-link');
  
  const prevActionPhone = document.getElementById('prev-action-phone');
  const prevActionEmail = document.getElementById('prev-action-email');
  const prevActionVcard = document.getElementById('prev-action-vcard');

  const prevBtnPhoneText = document.getElementById('prev-btn-phone-text');
  const prevBtnEmailText = document.getElementById('prev-btn-email-text');
  const prevCollabAddress = document.getElementById('prev-collab-address');

  // Sharing Panel Elements
  const sharingPanel = document.getElementById('sharing-panel');
  const collabQrCode = document.getElementById('collab-qr-code');
  const collabPublicUrl = document.getElementById('collab-public-url');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnExportZip = document.getElementById('btn-export-zip');

  // Login Modal Elements
  const loginModal = document.getElementById('login-modal');
  const btnCloseLogin = document.getElementById('btn-close-login');
  const loginForm = document.getElementById('login-form');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const loginErrorMsg = document.getElementById('login-error');
  const btnForgotPassword = document.getElementById('btn-forgot-password');
  const forgotModal = document.getElementById('forgot-password-modal');
  const forgotForm = document.getElementById('forgot-password-form');
  const forgotEmailInput = document.getElementById('forgot-email');
  const forgotMsg = document.getElementById('forgot-msg');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const resetModal = document.getElementById('reset-password-modal');
  const resetForm = document.getElementById('reset-password-form');
  const resetPasswordInput = document.getElementById('reset-password-input');
  const resetConfirmInput = document.getElementById('reset-confirm-input');
  const resetMsg = document.getElementById('reset-msg');
  const btnCloseReset = document.getElementById('btn-close-reset');

  // Admin View Elements
  const btnBackToCompanies = document.getElementById('btn-back-to-companies');
  const btnAddAdmin = document.getElementById('btn-add-admin');
  const adminListContainer = document.getElementById('admin-list');
  const adminFormContainer = document.getElementById('admin-form-container');
  const adminForm = document.getElementById('admin-form');
  const adminFormTitle = document.getElementById('admin-form-title');
  const adminModeInput = document.getElementById('admin-mode');
  const adminIdInput = document.getElementById('admin-id');
  const adminRoleInput = document.getElementById('admin-role');
  const adminIsSuperadminInput = document.getElementById('admin-is-superadmin');
  const adminFirstnameInput = document.getElementById('admin-firstname');
  const adminLastnameInput = document.getElementById('admin-lastname');
  const adminEmailInput = document.getElementById('admin-email');
  const adminPasswordInput = document.getElementById('admin-password');
  const adminCompaniesSelectionContainer = document.getElementById('admin-companies-selection-container');
  const adminCompaniesChecklist = document.getElementById('admin-companies-checklist');
  const btnSaveAdmin = document.getElementById('btn-save-admin');
  const btnCancelAdmin = document.getElementById('btn-cancel-admin');

  // Registration View Elements
  const registerForm = document.getElementById('register-form');
  const regCompanyNameInput = document.getElementById('reg-company-name');
  const regCompanyDomainInput = document.getElementById('reg-company-domain');
  const regAdminIdInput = document.getElementById('reg-admin-id');
  const regAdminEmailInput = document.getElementById('reg-admin-email');
  const regAdminFirstnameInput = document.getElementById('reg-admin-firstname');
  const regAdminLastnameInput = document.getElementById('reg-admin-lastname');
  const regAdminPasswordInput = null;
  const regErrorMsg = document.getElementById('register-error');
  const btnCancelRegister = document.getElementById('btn-cancel-register');
  const linkGotoLogin = document.getElementById('link-goto-login');
  const linkGotoRegister = document.getElementById('link-goto-register');

  // My Account Modal Elements
  const btnMyAccountShow = document.getElementById('btn-my-account-show');
  const myAccountModal = document.getElementById('my-account-modal');
  const myAccountForm = document.getElementById('my-account-form');
  const myAccFirstnameInput = document.getElementById('my-acc-firstname');
  const myAccLastnameInput = document.getElementById('my-acc-lastname');
  const myAccEmailInput = document.getElementById('my-acc-email');
  const myAccPasswordInput = document.getElementById('my-acc-password');
  const myAccConfirmPasswordInput = document.getElementById('my-acc-confirm-password');
  const myAccErrorMsg = document.getElementById('my-account-error');
  const btnCancelMyAccount = document.getElementById('btn-cancel-my-account');
  const btnCloseMyAccount = document.getElementById('btn-close-my-account');

  // Contact Captcha Modal Elements
  const linkTdconnectContact = document.getElementById('link-tdconnect-contact');
  const contactModal = document.getElementById('contact-modal');
  const btnCloseContact = document.getElementById('btn-close-contact');
  const btnCloseContactSuccess = document.getElementById('btn-close-contact-success');
  const btnSubmitCaptcha = document.getElementById('btn-submit-captcha');
  const chkHumanVerify = document.getElementById('chk-human-verify');
  const captchaErrorMsg = document.getElementById('captcha-error-msg');
  const contactCaptchaStep = document.getElementById('contact-captcha-step');
  const contactInfoStep = document.getElementById('contact-info-step');

  // --- State Variables ---
  let allCompanies = [];
  let logoFetchedUrl = '';
  let logoCustomUrl = '';
  let currentTheme = 'theme-glass';
  let currentFont = 'font-outfit';
  let currentAccentColor = '#8C52FF';
  let currentButtonStyle = 'rectangle';
  
  let currentCompanyId = null; // Scoped to active company
  let collaborators = [];
  let selectedCollabId = null;
  let currentCollabPhotoUrl = '';

  // --- Navigation & Router SPA System ---
  function navigateTo(hash, pushHistory = true) {
    const cleanHash = hash.startsWith('#') ? hash : '#' + hash;
    if (pushHistory) {
      if (window.location.hash !== cleanHash) {
        history.pushState({ hash: cleanHash }, '', cleanHash);
      }
    } else {
      if (window.location.hash !== cleanHash) {
        history.replaceState({ hash: cleanHash }, '', cleanHash);
      }
    }
    renderRoute(cleanHash);
  }

  function renderRoute(hash) {
    if (window.closeContactEncart) {
      window.closeContactEncart();
    }
    const rawHash = hash || window.location.hash || '#home';
    const cleanHash = rawHash.startsWith('#') ? rawHash : '#' + rawHash;
    const isLoggedIn = !!(authToken && currentUser);

    if (cleanHash.startsWith('#company/')) {
      const parts = cleanHash.split('/');
      const companyId = parts[1];
      if (isLoggedIn && companyId) {
        toggleAppView(true);
        if (currentCompanyId !== companyId) {
          loadCompanyDetail(companyId);
        } else {
          viewCompaniesList.classList.add('hidden');
          if (viewAdminPanel) viewAdminPanel.classList.add('hidden');
          viewCompanyDetail.classList.remove('hidden');
          updateLayoutMode();
        }
        return;
      }
    }

    if (cleanHash === '#admin') {
      if (isLoggedIn) {
        if (currentUser && currentUser.role === 'superadmin') {
          toggleAppView(true);
          viewCompaniesList.classList.add('hidden');
          if (viewCompanyDetail) viewCompanyDetail.classList.add('hidden');
          if (viewAdminPanel) viewAdminPanel.classList.remove('hidden');
          updateLayoutMode();
          closeAdminForm();
          loadAdminsList();
          return;
        } else {
          alert("Accès réservé aux Super Administrateurs.");
          navigateTo('#dashboard');
          return;
        }
      }
    }

    if (cleanHash === '#dashboard' || cleanHash === '#companies') {
      if (isLoggedIn) {
        toggleAppView(true);
        if (viewCompanyDetail) viewCompanyDetail.classList.add('hidden');
        if (viewAdminPanel) viewAdminPanel.classList.add('hidden');
        viewCompaniesList.classList.remove('hidden');
        updateLayoutMode();
        loadCompaniesList();
        return;
      }
    }

    // Default: Home Landing view
    toggleAppView(false);
  }

  function toggleAppView(toDashboard) {
    const isLoggedIn = !!(authToken && currentUser);

    if (btnNavDashboard) {
      if (isLoggedIn) btnNavDashboard.classList.remove('hidden');
      else btnNavDashboard.classList.add('hidden');
    }
    if (btnMyAccountShow) {
      if (isLoggedIn) btnMyAccountShow.classList.remove('hidden');
      else btnMyAccountShow.classList.add('hidden');
    }

    if (toDashboard && isLoggedIn) {
      viewLanding.classList.add('hidden');
      if (viewRegister) viewRegister.classList.add('hidden');
      if (viewCompanyDetail) viewCompanyDetail.classList.add('hidden');
      if (viewAdminPanel) viewAdminPanel.classList.add('hidden');
      viewDashboard.classList.remove('hidden');
      updateLayoutMode();
      
      if (btnLoginText) btnLoginText.textContent = 'Quitter';
      if (iconLogin) iconLogin.classList.add('hidden');
      if (iconLogout) iconLogout.classList.remove('hidden');
    } else {
      viewLanding.classList.remove('hidden');
      if (viewRegister) viewRegister.classList.add('hidden');
      viewDashboard.classList.add('hidden');
      if (viewCompanyDetail) viewCompanyDetail.classList.add('hidden');
      if (viewAdminPanel) viewAdminPanel.classList.add('hidden');
      updateLayoutMode();
      
      if (isLoggedIn) {
        if (btnLoginText) btnLoginText.textContent = 'Déconnexion';
        if (iconLogin) iconLogin.classList.add('hidden');
        if (iconLogout) iconLogout.classList.remove('hidden');
      } else {
        if (btnLoginText) btnLoginText.textContent = 'Connexion';
        if (iconLogin) iconLogin.classList.remove('hidden');
        if (iconLogout) iconLogout.classList.add('hidden');
      }
    }

    if (btnCtaStart) {
      const ctaSpan = btnCtaStart.querySelector('span');
      if (ctaSpan) {
        ctaSpan.textContent = isLoggedIn ? "Accéder à mes entreprises" : "Essayez, créez votre carte";
      }
    }
  }

  function showLoginModal() {
    if (loginModal) {
      loginModal.classList.remove('hidden');
      loginErrorMsg.classList.add('hidden');
      loginForm.reset();
      loginUsernameInput.focus();
    }
  }

  function hideLoginModal() {
    if (loginModal) {
      loginModal.classList.add('hidden');
    }
  }

  if (btnCloseLogin) btnCloseLogin.addEventListener('click', hideLoginModal);

  function logoutUser() {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('tdconnect_token');
    localStorage.removeItem('tdconnect_user');
    
    // Hide admin buttons
    if (btnAdminPanelShow) btnAdminPanelShow.classList.add('hidden');
    if (btnMyAccountShow) btnMyAccountShow.classList.add('hidden');
    if (myAccountModal) myAccountModal.classList.add('hidden');
    
    // Reset Views
    viewDashboard.classList.add('hidden');
    viewCompanyDetail.classList.add('hidden');
    if (viewAdminPanel) viewAdminPanel.classList.add('hidden');
    if (viewRegister) viewRegister.classList.add('hidden');
    viewCompaniesList.classList.remove('hidden');
    viewLanding.classList.remove('hidden');
    
    updateLayoutMode();

    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
    
    // Update login button to "Connexion"
    if (btnLoginText) btnLoginText.textContent = 'Connexion';
    if (iconLogin) iconLogin.classList.remove('hidden');
    if (iconLogout) iconLogout.classList.add('hidden');
  }

  if (btnLoginToggle) {
    btnLoginToggle.addEventListener('click', () => {
      const isLoggedIn = !!(authToken && currentUser);
      if (!isLoggedIn) {
        showLoginModal();
        return;
      }

      const isDashboardVisible = !viewDashboard.classList.contains('hidden');
      const isDetailVisible = viewCompanyDetail && !viewCompanyDetail.classList.contains('hidden');
      const isAdminPanelVisible = viewAdminPanel && !viewAdminPanel.classList.contains('hidden');
      const isRegisterVisible = viewRegister && !viewRegister.classList.contains('hidden');

      if (isDashboardVisible || isDetailVisible || isAdminPanelVisible || isRegisterVisible) {
        navigateTo('#home');
      } else {
        logoutUser();
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = loginUsernameInput.value.trim();
      const password = loginPasswordInput.value;
      
      if (username.length !== 8) {
        loginErrorMsg.textContent = "L'identifiant doit comporter exactement 8 caractères.";
        loginErrorMsg.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Identifiant ou mot de passe incorrect.");
        }
        
        const data = await res.json();
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('tdconnect_token', authToken);
        localStorage.setItem('tdconnect_user', JSON.stringify(currentUser));
        
        hideLoginModal();
        toggleAppView(true);
        loadCompaniesList();
        
        if (currentUser && currentUser.isTempPassword) {
          showMyAccountModal();
        }
      } catch (err) {
        loginErrorMsg.textContent = err.message;
        loginErrorMsg.classList.remove('hidden');
      }
    });
  }

  // --- Mot de passe oublié ---
  if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', () => {
      hideLoginModal();
      if (forgotModal) {
        forgotModal.classList.remove('hidden');
        if (forgotMsg) { forgotMsg.textContent = ''; forgotMsg.className = 'form-msg'; }
        if (forgotForm) forgotForm.reset();
        if (forgotEmailInput) forgotEmailInput.focus();
      }
    });
  }

  if (btnCloseForgot) btnCloseForgot.addEventListener('click', () => {
    if (forgotModal) forgotModal.classList.add('hidden');
  });

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = forgotEmailInput ? forgotEmailInput.value.trim() : '';
      if (!email) return;
      const btn = forgotForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Envoi...';
      try {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (forgotMsg) {
          forgotMsg.textContent = 'Si cette adresse est associée à un compte, un email de réinitialisation vient d\'y être envoyé.';
          forgotMsg.className = 'form-msg success';
        }
        if (forgotForm) forgotForm.reset();
      } catch (err) {
        if (forgotMsg) {
          forgotMsg.textContent = 'Erreur lors de l\'envoi. Veuillez réessayer.';
          forgotMsg.className = 'form-msg error';
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Envoyer le lien';
      }
    });
  }

  // --- Réinitialisation du mot de passe (via lien email) ---
  const resetAccountInfo = document.getElementById('reset-account-info');
  const resetInfoId = document.getElementById('reset-info-id');
  const resetInfoName = document.getElementById('reset-info-name');

  if (btnCloseReset) btnCloseReset.addEventListener('click', () => {
    if (resetModal) resetModal.classList.add('hidden');
  });

  async function openResetModal(token) {
    if (!resetModal) return;
    resetModal.classList.remove('hidden');
    resetModal.dataset.resetToken = token;
    if (resetMsg) { resetMsg.textContent = 'Vérification du lien en cours...'; resetMsg.className = 'form-msg'; }
    if (resetForm) { resetForm.reset(); resetForm.style.display = 'block'; }
    if (resetAccountInfo) resetAccountInfo.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-token/${token}`);
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || "Ce lien de réinitialisation est invalide ou a expiré.");
      }
      if (resetMsg) resetMsg.textContent = '';
      if (resetInfoId) resetInfoId.textContent = data.userId;
      if (resetInfoName) resetInfoName.textContent = `${data.firstName} ${data.lastName} (${data.email})`;
      if (resetAccountInfo) resetAccountInfo.classList.remove('hidden');
    } catch (err) {
      if (resetMsg) { resetMsg.textContent = err.message; resetMsg.className = 'form-msg error'; }
      if (resetForm) resetForm.style.display = 'none';
    }
  }

  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = resetModal ? resetModal.dataset.resetToken : '';
      const password = resetPasswordInput ? resetPasswordInput.value : '';
      const confirm = resetConfirmInput ? resetConfirmInput.value : '';
      const passErr = validatePasswordRules(password);
      if (passErr) {
        if (resetMsg) { resetMsg.textContent = passErr; resetMsg.className = 'form-msg error'; }
        return;
      }
      if (password !== confirm) {
        if (resetMsg) { resetMsg.textContent = 'Les mots de passe ne correspondent pas.'; resetMsg.className = 'form-msg error'; }
        return;
      }
      const btn = resetForm.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Enregistrement...';
      try {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (resetMsg) { resetMsg.textContent = 'Mot de passe réinitialisé avec succès ! Vous pouvez maintenant vous connecter.'; resetMsg.className = 'form-msg success'; }
        if (resetForm) resetForm.reset();
        if (resetAccountInfo) resetAccountInfo.classList.add('hidden');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          if (resetModal) resetModal.classList.add('hidden');
          showLoginModal();
        }, 2500);
      } catch (err) {
        if (resetMsg) { resetMsg.textContent = err.message || 'Erreur lors de la réinitialisation.'; resetMsg.className = 'form-msg error'; }
      } finally {
        btn.disabled = false; btn.textContent = 'Enregistrer le mot de passe';
      }
    });
  }

  // Detect public card URL in path: /card/xxx
  (function detectPublicCardRoute() {
    const pathname = window.location.pathname;
    if (pathname.includes('/card/')) {
      const cardId = pathname.substring(pathname.lastIndexOf('/card/') + 6);
      if (cardId) {
        fetch(`/card/${cardId}?ssr=1`)
          .then(res => res.text())
          .then(html => {
            if (html && (html.includes('<!DOCTYPE html>') || html.includes('card-container'))) {
              document.open();
              document.write(html);
              document.close();
            }
          })
          .catch(() => {});
      }
    }
  })();


  if (btnCtaStart) {
    btnCtaStart.addEventListener('click', () => {
      if (authToken) {
        navigateTo('#dashboard');
      } else {
        showRegisterView();
      }
    });
  }

  // --- Registration View Toggling & Form Submit Handling ---
  function showRegisterView() {
    viewLanding.classList.add('hidden');
    viewDashboard.classList.add('hidden');
    if (viewRegister) {
      viewRegister.classList.remove('hidden');
      regErrorMsg.classList.add('hidden');
      registerForm.reset();
      regCompanyNameInput.focus();
    }
    // Set nav button to "Quitter" so the user can easily click it to return to landing
    if (btnLoginText) btnLoginText.textContent = 'Quitter';
    if (iconLogin) iconLogin.classList.add('hidden');
    if (iconLogout) iconLogout.classList.remove('hidden');
  }

  function hideRegisterView() {
    if (viewRegister) viewRegister.classList.add('hidden');
    viewLanding.classList.remove('hidden');
    
    if (btnLoginText) btnLoginText.textContent = 'Connexion';
    if (iconLogin) iconLogin.classList.remove('hidden');
    if (iconLogout) iconLogout.classList.add('hidden');
  }

  if (btnCancelRegister) {
    btnCancelRegister.addEventListener('click', hideRegisterView);
  }

  if (linkGotoLogin) {
    linkGotoLogin.addEventListener('click', (e) => {
      e.preventDefault();
      hideRegisterView();
      showLoginModal();
    });
  }

  if (linkGotoRegister) {
    linkGotoRegister.addEventListener('click', (e) => {
      e.preventDefault();
      hideLoginModal();
      showRegisterView();
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const companyName = regCompanyNameInput.value.trim();
      const companyDomain = regCompanyDomainInput.value.trim();
      const userId = regAdminIdInput.value.trim();
      const email = regAdminEmailInput.value.trim();
      const firstName = regAdminFirstnameInput.value.trim();
      const lastName = regAdminLastnameInput.value.trim();

      if (userId.length !== 8) {
        regErrorMsg.textContent = "L'identifiant doit comporter exactement 8 caractères.";
        regErrorMsg.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName,
            companyDomain,
            userId,
            email,
            firstName,
            lastName
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Une erreur est survenue lors de l'inscription.");
        }

        const data = await res.json();

        // Redirect user: hide registration view and show login modal prefilled with entered identifier
        hideRegisterView();
        showLoginModal();
        if (loginUsernameInput) {
          loginUsernameInput.value = userId;
        }
        if (loginPasswordInput) {
          loginPasswordInput.value = '';
          loginPasswordInput.focus();
        }
        if (loginErrorMsg) {
          loginErrorMsg.textContent = `Compte "${userId}" créé avec succès ! Un e-mail avec votre mot de passe a été envoyé à ${email}.`;
          loginErrorMsg.className = 'form-msg success';
          loginErrorMsg.classList.remove('hidden');
        }
      } catch (err) {
        regErrorMsg.textContent = err.message;
        regErrorMsg.classList.remove('hidden');
      }
    });
  }

  // --- My Account Modal Actions & Form Submit Handling ---
  function showMyAccountModal() {
    if (myAccountModal && currentUser) {
      const myAccIdInput = document.getElementById('my-acc-id');
      if (myAccIdInput) {
        myAccIdInput.value = currentUser.id || '';
      }
      myAccFirstnameInput.value = currentUser.firstName || '';
      myAccLastnameInput.value = currentUser.lastName || '';
      myAccEmailInput.value = currentUser.email || '';
      myAccPasswordInput.value = '';
      if (myAccConfirmPasswordInput) {
        myAccConfirmPasswordInput.value = '';
      }
      myAccErrorMsg.classList.add('hidden');
      myAccountModal.classList.remove('hidden');
      myAccFirstnameInput.focus();

      // Enforce temporary password change
      const isForce = currentUser.isTempPassword;
      const btnClose = document.getElementById('btn-close-my-account');
      const btnCancel = document.getElementById('btn-cancel-my-account');
      
      if (isForce) {
        if (btnClose) btnClose.classList.add('hidden');
        if (btnCancel) btnCancel.classList.add('hidden');
        
        const passLabel = document.getElementById('my-acc-password-label');
        if (passLabel) {
          passLabel.textContent = "Nouveau mot de passe (Requis)";
        }
        
        // Show warning message
        let forceMsg = document.getElementById('my-account-force-msg');
        if (!forceMsg) {
          forceMsg = document.createElement('div');
          forceMsg.id = 'my-account-force-msg';
          forceMsg.className = 'error-msg-box';
          forceMsg.style.background = 'rgba(245, 158, 11, 0.12)';
          forceMsg.style.borderColor = 'rgba(245, 158, 11, 0.25)';
          forceMsg.style.color = '#f59e0b';
          forceMsg.style.marginBottom = '1rem';
          forceMsg.textContent = "Veuillez définir votre mot de passe pour finaliser la création de votre compte.";
          myAccountForm.insertBefore(forceMsg, myAccountForm.firstChild);
        } else {
          forceMsg.classList.remove('hidden');
        }
        
        myAccPasswordInput.required = true;
        if (myAccConfirmPasswordInput) myAccConfirmPasswordInput.required = true;
      } else {
        if (btnClose) btnClose.classList.remove('hidden');
        if (btnCancel) btnCancel.classList.remove('hidden');
        
        const passLabel = document.getElementById('my-acc-password-label');
        if (passLabel) {
          passLabel.textContent = "Nouveau mot de passe (laisser vide pour ne pas changer)";
        }
        
        const forceMsg = document.getElementById('my-account-force-msg');
        if (forceMsg) forceMsg.classList.add('hidden');
        
        myAccPasswordInput.required = false;
        if (myAccConfirmPasswordInput) myAccConfirmPasswordInput.required = false;
      }
    }
  }

  function hideMyAccountModal() {
    if (myAccountModal) {
      myAccountModal.classList.add('hidden');
    }
  }

  if (btnMyAccountShow) {
    btnMyAccountShow.addEventListener('click', showMyAccountModal);
  }

  if (btnCancelMyAccount) {
    btnCancelMyAccount.addEventListener('click', hideMyAccountModal);
  }

  if (btnCloseMyAccount) {
    btnCloseMyAccount.addEventListener('click', hideMyAccountModal);
  }

  // --- Contact Captcha Modal Actions ---
  function openContactModal() {
    const modalEl = document.getElementById('contact-modal') || contactModal;
    const chkVerifyEl = document.getElementById('chk-human-verify') || chkHumanVerify;
    const captchaErrMsgEl = document.getElementById('captcha-error-msg') || captchaErrorMsg;
    const captchaStepEl = document.getElementById('contact-captcha-step') || contactCaptchaStep;
    const infoStepEl = document.getElementById('contact-info-step') || contactInfoStep;

    if (modalEl) {
      if (chkVerifyEl) chkVerifyEl.checked = false;
      if (captchaErrMsgEl) captchaErrMsgEl.classList.add('hidden');
      if (captchaStepEl) captchaStepEl.classList.remove('hidden');
      if (infoStepEl) infoStepEl.classList.add('hidden');
      modalEl.classList.remove('hidden');
    }
  }

  window.openContactModal = openContactModal;

  function hideContactModal() {
    const modalEl = document.getElementById('contact-modal') || contactModal;
    if (modalEl) {
      modalEl.classList.add('hidden');
    }
  }

  // Global event delegation for contact link clicks anywhere in the app
  document.addEventListener('click', (e) => {
    const targetLink = e.target ? e.target.closest('#link-tdconnect-contact, .link-tdconnect-contact') : null;
    if (targetLink) {
      e.preventDefault();
      e.stopPropagation();
      if (window.openContactEncart) {
        window.openContactEncart();
      } else {
        openContactModal();
      }
    }
  });

  if (btnCloseContact) btnCloseContact.addEventListener('click', hideContactModal);
  if (btnCloseContactSuccess) btnCloseContactSuccess.addEventListener('click', hideContactModal);

  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) hideContactModal();
    });
  }

  if (btnSubmitCaptcha) {
    btnSubmitCaptcha.addEventListener('click', () => {
      const chkVerifyEl = document.getElementById('chk-human-verify') || chkHumanVerify;
      const captchaErrMsgEl = document.getElementById('captcha-error-msg') || captchaErrorMsg;
      const captchaStepEl = document.getElementById('contact-captcha-step') || contactCaptchaStep;
      const infoStepEl = document.getElementById('contact-info-step') || contactInfoStep;

      if (chkVerifyEl && chkVerifyEl.checked) {
        if (captchaErrMsgEl) captchaErrMsgEl.classList.add('hidden');
        if (captchaStepEl) captchaStepEl.classList.add('hidden');
        if (infoStepEl) infoStepEl.classList.remove('hidden');
      } else {
        if (captchaErrMsgEl) captchaErrMsgEl.classList.remove('hidden');
      }
    });
  }

  if (myAccountForm) {
    myAccountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const firstName = myAccFirstnameInput.value.trim();
      const lastName = myAccLastnameInput.value.trim();
      const email = myAccEmailInput.value.trim();
      const password = myAccPasswordInput.value;
      const confirmPassword = myAccConfirmPasswordInput ? myAccConfirmPasswordInput.value : '';

      if (!firstName || !lastName || !email) {
        myAccErrorMsg.textContent = "Veuillez remplir tous les champs obligatoires.";
        myAccErrorMsg.classList.remove('hidden');
        return;
      }
      
      if (currentUser && currentUser.isTempPassword && !password) {
        myAccErrorMsg.textContent = "Veuillez saisir votre nouveau mot de passe.";
        myAccErrorMsg.classList.remove('hidden');
        return;
      }

      if (password) {
        const passErr = validatePasswordRules(password);
        if (passErr) {
          myAccErrorMsg.textContent = passErr;
          myAccErrorMsg.classList.remove('hidden');
          return;
        }
        if (password !== confirmPassword) {
          myAccErrorMsg.textContent = "Les deux mots de passe ne correspondent pas.";
          myAccErrorMsg.classList.remove('hidden');
          return;
        }
      }

      const payload = { firstName, lastName, email };
      if (password) {
        payload.password = password;
      }

      try {
        const res = await apiFetch(`${API_BASE}/auth/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Une erreur est survenue lors de la mise à jour.");
        }

        authToken = data.token;
        currentUser = data.user;

        localStorage.setItem('tdconnect_token', authToken);
        localStorage.setItem('tdconnect_user', JSON.stringify(currentUser));

        hideMyAccountModal();
        alert("Vos informations de compte ont été mises à jour avec succès !");
      } catch (err) {
        myAccErrorMsg.textContent = err.message;
        myAccErrorMsg.classList.remove('hidden');
      }
    });
  }

  if (navLogo) {
    navLogo.addEventListener('click', () => {
      navigateTo('#home');
    });
  }

  if (btnNavHome) {
    btnNavHome.addEventListener('click', () => {
      navigateTo('#home');
    });
  }

  if (btnNavDashboard) {
    btnNavDashboard.addEventListener('click', () => {
      if (authToken && currentUser) {
        navigateTo('#dashboard');
      } else {
        showLoginModal();
      }
    });
  }

  // --- Sidebar Tab Switching ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));

      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      document.getElementById(targetTab).classList.remove('hidden');
    });
  });

  // --- Admin Panel Navigation & Management Logic ---
  if (btnAdminPanelShow) {
    btnAdminPanelShow.addEventListener('click', () => {
      navigateTo('#admin');
    });
  }

  if (btnBackToCompanies) {
    btnBackToCompanies.addEventListener('click', () => {
      navigateTo('#dashboard');
    });
  }

  let allAdmins = [];
  let allCompaniesForAdmin = [];
  async function loadAdminsList() {
    try {
      const [resAdmins, resCompanies] = await Promise.all([
        apiFetch(`${API_BASE}/admin/users`),
        apiFetch(`${API_BASE}/companies`)
      ]);
      allAdmins = await resAdmins.json();
      allCompaniesForAdmin = await resCompanies.json();
      renderAdminsList();
    } catch (err) {
      console.error("Erreur chargement administrateurs:", err);
      adminListContainer.innerHTML = '<p class="empty-list-msg" style="color:#f43f5e;">Erreur lors du chargement des administrateurs.</p>';
    }
  }

  function renderAdminsList() {
    adminListContainer.innerHTML = '';
    if (allAdmins.length === 0) {
      adminListContainer.innerHTML = '<p class="empty-list-msg">Aucun administrateur créé.</p>';
      return;
    }

    allAdmins.forEach(admin => {
      const item = document.createElement('div');
      item.className = 'collab-item';
      
      const isSuper = admin.role === 'superadmin';
      const roleBadge = isSuper 
        ? `<span class="admin-badge superadmin">Super Admin</span>`
        : `<span class="admin-badge admin">Admin</span>`;

      let compBadges;
      if (isSuper) {
        compBadges = `<span class="admin-companies-count">Toutes les entreprises</span>`;
      } else if (admin.managedCompanies && admin.managedCompanies.length > 0) {
        const names = admin.managedCompanies.map(id => {
          const found = allCompaniesForAdmin.find(c => c.id === id);
          return found ? `<span class="admin-company-pill">${found.name}</span>` : '';
        }).filter(Boolean).join('');
        compBadges = `<span class="admin-companies-pills">${names}</span>`;
      } else {
        compBadges = `<span class="admin-companies-count" style="opacity:0.5;">Aucune entreprise</span>`;
      }

      const canDelete = admin.id !== 'superadm' && (currentUser && admin.id !== currentUser.id);
      const deleteBtnHtml = canDelete 
        ? `<button type="button" class="btn-item-delete" title="Supprimer">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
           </button>`
        : '';
      const canToggleSuper = admin.id !== 'superadm' && (currentUser && admin.id !== currentUser.id);
      const superToggleHtml = `
        <label title="${isSuper ? 'Rétrograder en administrateur standard' : 'Promouvoir en Super Administrateur'}" style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; background: rgba(99, 102, 241, 0.1); padding: 0.3rem 0.55rem; border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.25); margin-right: 0.35rem;">
          <input type="checkbox" class="btn-item-super-toggle" ${isSuper ? 'checked' : ''} ${!canToggleSuper ? 'disabled' : ''} style="width: 14px; height: 14px; accent-color: var(--accent); cursor: pointer;" />
          <span style="font-size: 0.76rem; font-weight: 600; color: ${isSuper ? '#818cf8' : 'var(--text-muted)'}">Super Admin</span>
        </label>
      `;

      item.innerHTML = `
        <div class="collab-item-info">
          <span class="collab-item-name">${admin.firstName} ${admin.lastName} (${admin.id})</span>
          <span class="collab-item-role">${roleBadge} &nbsp; ${compBadges} &nbsp; ${admin.email}</span>
        </div>
        <div class="collab-item-actions">
          ${superToggleHtml}
          <button type="button" class="btn-item-edit" title="Modifier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          ${deleteBtnHtml}
        </div>
      `;

      item.querySelector('.btn-item-edit').addEventListener('click', () => {
        openAdminForm(admin);
      });

      if (canToggleSuper) {
        const toggleCb = item.querySelector('.btn-item-super-toggle');
        if (toggleCb) {
          toggleCb.addEventListener('change', async (e) => {
            const nextRole = e.target.checked ? 'superadmin' : 'admin';
            try {
              await apiFetch(`${API_BASE}/admin/users/${admin.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  firstName: admin.firstName,
                  lastName: admin.lastName,
                  email: admin.email,
                  role: nextRole,
                  managedCompanies: nextRole === 'superadmin' ? [] : (admin.managedCompanies || [])
                })
              });
              loadAdminsList();
            } catch (err) {
              console.error("Erreur modification statut superadmin:", err);
              alert("Erreur lors de la modification du rôle.");
              e.target.checked = !e.target.checked;
            }
          });
        }
      }

      if (canDelete) {
        item.querySelector('.btn-item-delete').addEventListener('click', () => {
          deleteAdmin(admin.id);
        });
      }

      adminListContainer.appendChild(item);
    });
  }

  async function deleteAdmin(id) {
    if (confirm(`Voulez-vous vraiment supprimer l'administrateur ${id} ?`)) {
      try {
        await apiFetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' });
        loadAdminsList();
      } catch (err) {
        console.error("Erreur suppression admin:", err);
        alert("Erreur lors de la suppression de l'administrateur.");
      }
    }
  }

  function openAdminForm(admin = null) {
    adminFormContainer.classList.remove('hidden');
    renderCompaniesChecklist();

    if (admin) {
      adminFormTitle.textContent = "Modifier l'administrateur";
      adminModeInput.value = 'edit';
      adminIdInput.value = admin.id;
      adminIdInput.disabled = true;
      adminFirstnameInput.value = admin.firstName;
      adminLastnameInput.value = admin.lastName;
      adminEmailInput.value = admin.email;
      if (adminRoleInput) adminRoleInput.value = admin.role;
      if (adminIsSuperadminInput) {
        adminIsSuperadminInput.checked = (admin.role === 'superadmin');
        const isSelfOrPrimary = admin.id === 'superadm' || (currentUser && admin.id === currentUser.id);
        adminIsSuperadminInput.disabled = isSelfOrPrimary;
        adminIsSuperadminInput.title = isSelfOrPrimary ? "Le statut du compte Super Admin principal ne peut pas être modifié ici." : "";
      }
      adminPasswordInput.value = '';
      document.getElementById('admin-password-help').style.display = 'inline';

      const checklistInputs = adminCompaniesChecklist.querySelectorAll('input[type="checkbox"]');
      checklistInputs.forEach(cb => {
        cb.checked = admin.managedCompanies && admin.managedCompanies.includes(parseInt(cb.value));
      });

      toggleCompaniesContainer(admin.role);
    } else {
      adminFormTitle.textContent = "Nouvel administrateur";
      adminModeInput.value = 'create';
      adminIdInput.value = '';
      adminIdInput.disabled = false;
      adminForm.reset();
      if (adminRoleInput) adminRoleInput.value = 'admin';
      if (adminIsSuperadminInput) {
        adminIsSuperadminInput.checked = false;
        adminIsSuperadminInput.disabled = false;
        adminIsSuperadminInput.title = "";
      }
      document.getElementById('admin-password-help').style.display = 'none';

      toggleCompaniesContainer('admin');
    }
    adminFirstnameInput.focus();
  }

  function toggleCompaniesContainer(role) {
    if (role === 'superadmin') {
      adminCompaniesSelectionContainer.classList.add('hidden');
    } else {
      adminCompaniesSelectionContainer.classList.remove('hidden');
    }
  }

  if (adminIsSuperadminInput) {
    adminIsSuperadminInput.addEventListener('change', (e) => {
      const role = e.target.checked ? 'superadmin' : 'admin';
      if (adminRoleInput) adminRoleInput.value = role;
      toggleCompaniesContainer(role);
    });
  }
  if (adminRoleInput) {
    adminRoleInput.addEventListener('change', (e) => {
      if (adminIsSuperadminInput) adminIsSuperadminInput.checked = (e.target.value === 'superadmin');
      toggleCompaniesContainer(e.target.value);
    });
  }

  function closeAdminForm() {
    adminFormContainer.classList.add('hidden');
    adminForm.reset();
    adminIdInput.disabled = false;
  }

  if (btnAddAdmin) btnAddAdmin.addEventListener('click', () => openAdminForm());
  if (btnCancelAdmin) btnCancelAdmin.addEventListener('click', closeAdminForm);

  function renderCompaniesChecklist() {
    adminCompaniesChecklist.innerHTML = '';
    if (allCompanies.length === 0) {
      adminCompaniesChecklist.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted);">Aucune entreprise disponible.</span>';
      return;
    }
    allCompanies.forEach(c => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.5rem';
      label.style.cursor = 'pointer';
      label.innerHTML = `
        <input type="checkbox" value="${c.id}" />
        <span>${c.name}</span>
      `;
      adminCompaniesChecklist.appendChild(label);
    });
  }

  if (btnSaveAdmin) {
    btnSaveAdmin.addEventListener('click', async () => {
      const mode = adminModeInput.value;
      const id = adminIdInput.value.trim();
      const firstName = adminFirstnameInput.value.trim();
      const lastName = adminLastnameInput.value.trim();
      const email = adminEmailInput.value.trim();
      const role = (adminIsSuperadminInput && adminIsSuperadminInput.checked) 
        ? 'superadmin' 
        : (adminRoleInput ? adminRoleInput.value : 'admin');
      const password = adminPasswordInput.value;

      if (!id || id.length !== 8) {
        alert("L'identifiant doit comporter exactement 8 caractères.");
        return;
      }
      if (!firstName || !lastName || !email) {
        alert("Veuillez remplir tous les champs obligatoires (Prénom, Nom, Email).");
        return;
      }
      if (mode === 'create' || password) {
        const passErr = validatePasswordRules(password);
        if (passErr) {
          alert(passErr);
          return;
        }
      }

      const managedCompanies = [];
      if (role === 'admin') {
        const checked = adminCompaniesChecklist.querySelectorAll('input[type="checkbox"]:checked');
        checked.forEach(cb => managedCompanies.push(parseInt(cb.value)));
      }

      const payload = {
        id,
        firstName,
        lastName,
        email,
        role,
        managedCompanies
      };
      if (password) {
        payload.password = password;
      }

      try {
        if (mode === 'create') {
          await apiFetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          await apiFetch(`${API_BASE}/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        closeAdminForm();
        loadAdminsList();
      } catch (err) {
        console.error("Erreur lors de la sauvegarde de l'administrateur:", err);
        alert(err.message || "Erreur lors de la sauvegarde de l'administrateur.");
      }
    });
  }

  // --- Save Company Info manually via button click ---
  const btnSaveCompany = document.getElementById('btn-save-company');
  if (btnSaveCompany) {
    btnSaveCompany.addEventListener('click', async () => {
      if (!currentCompanyId) return;

      btnSaveCompany.disabled = true;
      btnSaveCompany.textContent = 'Enregistrement...';

      const data = {
        name: companyNameInput.value.trim(),
        domain: companyDomainInput.value.trim(),
        address: companyAddressInput.value.trim(),
        zip: companyZipInput.value.trim(),
        city: companyCityInput.value.trim(),
        country: companyCountryInput.value.trim(),
        subscription_end_date: companySubscriptionEndInput ? companySubscriptionEndInput.value : null,
        is_subscription_active: companyIsSubscriptionActiveInput ? (companyIsSubscriptionActiveInput.checked ? 0 : 1) : 1,
        logo_custom_url: logoCustomUrl || '',
        theme: currentTheme,
        font: currentFont,
        accent_color: currentAccentColor,
        logo_size: parseInt(companyLogoSizeInput.value, 10),
        logo_x: companyLogoXInput ? parseInt(companyLogoXInput.value, 10) : 0,
        button_style: currentButtonStyle,
        avatar_size: companyAvatarSizeInput ? parseInt(companyAvatarSizeInput.value, 10) : 100,
        show_name_under_logo: companyShowNameInput ? (companyShowNameInput.checked ? 1 : 0) : 1,
        show_tdconnect_message: companyShowMessageInput ? (companyShowMessageInput.checked ? 1 : 0) : 0,
        tdconnect_message: companyMessageTextInput ? companyMessageTextInput.value.trim() : '',
        tdconnect_url: companyMessageUrlInput ? companyMessageUrlInput.value.trim() : ''
      };

      try {
        await apiFetch(`${API_BASE}/companies/${currentCompanyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        console.log(`Entreprise ${currentCompanyId} enregistrée.`);
        activeCompanyTitle.textContent = data.name;

        // Visual success confirmation on button
        btnSaveCompany.textContent = 'Enregistré !';
        btnSaveCompany.style.backgroundColor = 'var(--success-color)';
        setTimeout(() => {
          btnSaveCompany.disabled = false;
          btnSaveCompany.textContent = 'Valider les modifications';
          btnSaveCompany.style.backgroundColor = '';
        }, 2000);
      } catch (err) {
        console.error("Échec de la sauvegarde de l'entreprise:", err);
        alert("Erreur lors de la sauvegarde de l'entreprise.");
        btnSaveCompany.disabled = false;
        btnSaveCompany.textContent = 'Valider les modifications';
      }
    });
  }

  // --- Real-time Saisie Synchro (Company Preview updates) ---
  
  function updateCompanyPreview() {
    if (!logoCustomUrl && !logoFetchedUrl) {
      setFallbackLogo();
    } else {
      cardLogo.src = logoCustomUrl || logoFetchedUrl;
    }

    // Show/hide company name under logo
    if (companyShowNameInput && companyShowNameInput.checked) {
      if (prevCompanyNameUnderLogo) {
        prevCompanyNameUnderLogo.textContent = companyNameInput.value.trim() || 'TDConnect';
        prevCompanyNameUnderLogo.classList.remove('hidden');
      }
    } else {
      if (prevCompanyNameUnderLogo) {
        prevCompanyNameUnderLogo.classList.add('hidden');
      }
    }

    // Show/hide custom message under footer
    if (companyShowMessageInput && companyShowMessageInput.checked) {
      if (companyMessageContainer) {
        companyMessageContainer.classList.remove('hidden');
      }
      if (prevCompanyMessageUnderFooter) {
        const msgText = companyMessageTextInput ? companyMessageTextInput.value.trim() : '';
        const msgUrl = companyMessageUrlInput ? companyMessageUrlInput.value.trim() : '';
        if (msgText) {
          if (msgUrl) {
            const targetUrl = msgUrl.startsWith('http') ? msgUrl : 'https://' + msgUrl;
            prevCompanyMessageUnderFooter.innerHTML = `<a href="${targetUrl}" target="_blank" style="color: inherit; text-decoration: underline; cursor: pointer;">${msgText}</a>`;
          } else {
            prevCompanyMessageUnderFooter.textContent = msgText;
          }
          prevCompanyMessageUnderFooter.classList.remove('hidden');
        } else {
          prevCompanyMessageUnderFooter.classList.add('hidden');
        }
      }
    } else {
      if (companyMessageContainer) {
        companyMessageContainer.classList.add('hidden');
      }
      if (prevCompanyMessageUnderFooter) {
        prevCompanyMessageUnderFooter.classList.add('hidden');
      }
    }

    // Apply company avatar size
    if (companyAvatarSizeInput && companyAvatarSizeVal) {
      const size = companyAvatarSizeInput.value;
      companyAvatarSizeVal.textContent = `${size}px`;
      if (prevAvatarWrapper) {
        prevAvatarWrapper.style.width = `${size}px`;
        prevAvatarWrapper.style.height = `${size}px`;
      }
      if (prevAvatarInitials) {
        prevAvatarInitials.style.fontSize = `${size * 0.35}px`;
      }
    }

    updateMockupPreview();
  }

  if (companyShowNameInput) {
    companyShowNameInput.addEventListener('change', () => {
      updateCompanyPreview();
    });
  }

  if (companyShowMessageInput) {
    companyShowMessageInput.addEventListener('change', () => {
      updateCompanyPreview();
    });
  }

  if (companyIsSubscriptionActiveInput) {
    companyIsSubscriptionActiveInput.addEventListener('change', () => {
      const testBanner = document.getElementById('company-test-banner');
      if (testBanner) {
        if (companyIsSubscriptionActiveInput.checked) {
          testBanner.classList.add('hidden');
        } else {
          testBanner.classList.remove('hidden');
        }
      }
      updateMockupPreview();
    });
  }

  [companyNameInput, companyAddressInput, companyZipInput, companyCityInput, companyCountryInput, companyDomainInput, companySubscriptionEndInput, companyAvatarSizeInput, companyMessageTextInput, companyMessageUrlInput].filter(Boolean).forEach(input => {
    input.addEventListener('input', () => {
      updateCompanyPreview();
      updateMockupPreview();
    });
  });

  // --- Logo Handling & Fetch API ---

  function getCompanyInitials(name) {
    if (!name || !name.trim()) return 'EC';
    const clean = name.trim();
    const words = clean.split(/[\s\-]+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  }

  function getCollaboratorInitials(firstName, lastName) {
    const f = (firstName || '').trim();
    const l = (lastName || '').trim();
    const fInit = f ? f[0].toUpperCase() : '';
    const lInit = l ? l[0].toUpperCase() : '';
    return (fInit + lInit) || 'C';
  }

  function getFallbackLogoSVG(name) {
    const initials = getCompanyInitials(name);
    const color = encodeURIComponent(currentAccentColor);
    const textFill = currentTheme === 'theme-minimalist' ? '%230f172a' : '%23ffffff';
    const bgFill = currentTheme === 'theme-minimalist' ? '%23f1f5f9' : '%231e293b';

    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='${bgFill}' stroke='${color}' stroke-width='3'/><text x='50%' y='55%' font-family='Outfit, sans-serif' font-weight='800' font-size='38' fill='${color}' dominant-baseline='middle' text-anchor='middle'>${initials}</text></svg>`;
  }

  function setFallbackLogo() {
    const fallback = getFallbackLogoSVG(companyNameInput.value.trim());
    cardLogo.src = fallback;
  }

  function fetchLogoFromDomain() {
    // Logo automatique par domaine désactivé.
    // Seul un logo uploadé manuellement est utilisé.
    logoFetchedUrl = '';
    if (!logoCustomUrl) {
      setFallbackLogo();
    }
    cardLogo.style.opacity = '1';
  }

  btnFetchLogo.addEventListener('click', fetchLogoFromDomain);
  companyDomainInput.addEventListener('blur', fetchLogoFromDomain);
  companyDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      fetchLogoFromDomain();
      e.preventDefault();
    }
  });

  // --- Custom File Upload Drag & Drop (Company Logo) ---

  function handleLogoFile(file) {
    if (!file || !file.type.match('image.*')) {
      alert("Veuillez sélectionner un fichier image valide (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (max 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      logoCustomUrl = e.target.result;
      thumbImg.src = logoCustomUrl;
      document.querySelector('.thumb-name').textContent = file.name;
      logoPreviewThumb.classList.remove('hidden');
      cardLogo.src = logoCustomUrl;
    };
    reader.readAsDataURL(file);
  }

  logoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleLogoFile(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleLogoFile(files[0]);
    }
  });

  btnRemoveLogo.addEventListener('click', (e) => {
    e.stopPropagation();
    logoCustomUrl = '';
    logoFileInput.value = '';
    logoPreviewThumb.classList.add('hidden');
    if (logoFetchedUrl) {
      cardLogo.src = logoFetchedUrl;
    } else {
      setFallbackLogo();
    }
  });

  dropZone.addEventListener('click', () => {
    logoFileInput.click();
  });

  // --- Themes Customization ---

  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const themeValue = e.target.value;
      cardElement.classList.remove(currentTheme);
      cardElement.classList.add(themeValue);
      currentTheme = themeValue;
      updateCompanyPreview();
    });
  });

  // --- Fonts Customization ---

  fontButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      fontButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const font = btn.dataset.font;
      cardElement.classList.remove(currentFont);
      cardElement.classList.add(font);
      currentFont = font;
    });
  });

  // --- Accent Colors ---

  function applyAccentColor(color) {
    currentAccentColor = color;
    cardElement.style.setProperty('--accent-color', color);
    if (!logoCustomUrl && !logoFetchedUrl) {
      setFallbackLogo();
    }
  }

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.dataset.color;
      applyAccentColor(color);
      customColorInput.value = color;
    });
  });

  customColorInput.addEventListener('input', (e) => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    const color = e.target.value;
    applyAccentColor(color);
  });

  // --- Collaborator Profile Photo Upload Handling ---

  function handleCollabPhotoFile(file) {
    if (!file || !file.type.match('image.*')) {
      alert("Veuillez sélectionner un fichier image valide (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Le fichier est trop volumineux (max 2 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentCollabPhotoUrl = e.target.result;
      collabThumbImg.src = currentCollabPhotoUrl;
      collabPhotoThumb.classList.remove('hidden');
      
      // Show crop sliders and reset to defaults
      photoFramingControls.classList.remove('hidden');
      collabPhotoZoomInput.value = 1.0;
      collabPhotoXInput.value = 50;
      collabPhotoYInput.value = 50;

      // Update preview profile photo if selected
      prevAvatarImg.src = currentCollabPhotoUrl;
      prevAvatarImg.classList.remove('hidden');
      prevAvatarInitials.classList.add('hidden');
      prevAvatarImg.style.transform = 'scale(1.0)';
      prevAvatarImg.style.transformOrigin = '50% 50%';
    };
    reader.readAsDataURL(file);
  }

  collabPhotoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleCollabPhotoFile(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    collabPhotoZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      collabPhotoZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    collabPhotoZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      collabPhotoZone.classList.remove('drag-over');
    }, false);
  });

  collabPhotoZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleCollabPhotoFile(files[0]);
    }
  });

  btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    currentCollabPhotoUrl = '';
    collabPhotoFileInput.value = '';
    collabPhotoThumb.classList.add('hidden');
    photoFramingControls.classList.add('hidden');
    
    // Reset mockup preview profile image
    prevAvatarImg.classList.add('hidden');
    prevAvatarInitials.classList.remove('hidden');
  });

  collabPhotoZone.addEventListener('click', () => {
    collabPhotoFileInput.click();
  });

  // Photo Framing Live Sliders Synchro
  function updatePhotoFramingPreview() {
    const zoom = parseFloat(collabPhotoZoomInput.value) || 1.0;
    const x = parseFloat(collabPhotoXInput.value) || 50;
    const y = parseFloat(collabPhotoYInput.value) || 50;
    
    prevAvatarImg.style.transform = `scale(${zoom})`;
    prevAvatarImg.style.transformOrigin = `${x}% ${y}%`;
  }

  [collabPhotoZoomInput, collabPhotoXInput, collabPhotoYInput].filter(Boolean).forEach(slider => {
    slider.addEventListener('input', updatePhotoFramingPreview);
  });

  // Address helper: format street, zip, city, country into clean multi-line display with word-wrap protection
  function buildFormattedAddress(collabAddr, companyStreet, companyZip, companyCity, companyCountry) {
    if (collabAddr && collabAddr.trim()) {
      const raw = collabAddr.trim();
      if (raw.includes('\n')) {
        return raw.replace(/\r\n|\r|\n/g, '<br/>');
      } else if (raw.includes(',')) {
        return raw.split(',').map(s => s.trim()).filter(Boolean).join('<br/>');
      }
      return raw;
    }

    const street = (companyStreet || '').trim();
    const zip = (companyZip || '').trim();
    const city = (companyCity || '').trim();
    const country = (companyCountry || '').trim();

    const lines = [];
    if (street) lines.push(street);
    const zipCity = [zip, city].filter(Boolean).join(' ');
    if (zipCity) lines.push(zipCity);
    if (country) lines.push(country);

    return lines.join('<br/>');
  }

  // --- Collaborator Card Preview Rendering inside Mockup ---

  function updateMockupPreview() {
    const collab = collaborators.find(c => c.id === selectedCollabId);

    // Check Subscription Expiration & Collaborator Active status for live blur preview
    // Checkbox is "Accès suspendu" -> checked means access IS suspended!
    const isSuspended = companyIsSubscriptionActiveInput ? companyIsSubscriptionActiveInput.checked : false;
    const subEndDateVal = companySubscriptionEndInput ? companySubscriptionEndInput.value : '';
    const todayStr = new Date().toISOString().split('T')[0];
    const isDateExpired = subEndDateVal && (subEndDateVal < todayStr);
    const isCollabInactive = collab && (collab.isActive === 0 || collab.is_active === 0);

    const prevCardBlurOverlay = document.getElementById('prev-card-blur-overlay');
    const prevBlurTitle = document.getElementById('prev-blur-title');
    const prevBlurSubtitle = document.getElementById('prev-blur-subtitle');

    if (prevCardBlurOverlay) {
      if (isSuspended) {
        if (prevBlurTitle) prevBlurTitle.textContent = 'Accès suspendu';
        if (prevBlurSubtitle) prevBlurSubtitle.textContent = "L'accès aux cartes de cette entreprise a été suspendu par l'administrateur.";
        prevCardBlurOverlay.classList.remove('hidden');
        if (cardElement) cardElement.style.filter = 'blur(6px) opacity(0.5)';
      } else if (isDateExpired) {
        if (prevBlurTitle) prevBlurTitle.textContent = 'Abonnement échu';
        if (prevBlurSubtitle) prevBlurSubtitle.textContent = "L'abonnement de cette entreprise a expiré.";
        prevCardBlurOverlay.classList.remove('hidden');
        if (cardElement) cardElement.style.filter = 'blur(6px) opacity(0.5)';
      } else if (isCollabInactive) {
        if (prevBlurTitle) prevBlurTitle.textContent = 'Collaborateur inactif';
        if (prevBlurSubtitle) prevBlurSubtitle.textContent = 'Cette carte de visite est actuellement désactivée.';
        prevCardBlurOverlay.classList.remove('hidden');
        if (cardElement) cardElement.style.filter = 'blur(6px) opacity(0.5)';
      } else {
        prevCardBlurOverlay.classList.add('hidden');
        if (cardElement) cardElement.style.filter = 'none';
      }
    }

    previewPlaceholderMsg.classList.add('hidden');
    previewCollabContent.classList.remove('hidden');

    if (collab) {
      sharingPanel.classList.remove('hidden');

      // Connection counter & ZIP Export display for Super Admin only
      const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
      if (collabConnectionCounterDisplay) {
        if (isSuperAdmin) {
          collabConnectionCounterDisplay.classList.remove('hidden');
          if (collabConnectionCountBadge) {
            const count = collab.connectionCount != null ? collab.connectionCount : 0;
            collabConnectionCountBadge.textContent = `${count} visite(s)`;
          }
        } else {
          collabConnectionCounterDisplay.classList.add('hidden');
        }
      }
      if (collabExportZipContainer) {
        if (isSuperAdmin) {
          collabExportZipContainer.classList.remove('hidden');
        } else {
          collabExportZipContainer.classList.add('hidden');
        }
      }

      const prefix = collab.civility ? collab.civility.trim() + ' ' : '';
      prevCollabName.textContent = `${prefix}${collab.lastName.toUpperCase()} ${collab.firstName}`;
      
      prevCollabRole.textContent = collab.role || '';
      if (collab.role) {
        prevCollabRole.classList.remove('hidden');
      } else {
        prevCollabRole.classList.add('hidden');
      }

      // Address formatting & fallback
      const formattedAddr = buildFormattedAddress(
        collab.address,
        companyAddressInput ? companyAddressInput.value : '',
        companyZipInput ? companyZipInput.value : '',
        companyCityInput ? companyCityInput.value : '',
        companyCountryInput ? companyCountryInput.value : ''
      );

      if (formattedAddr) {
        prevCollabAddress.innerHTML = formattedAddr;
        prevCollabAddress.classList.remove('hidden');
      } else {
        prevCollabAddress.innerHTML = '';
        prevCollabAddress.classList.add('hidden');
      }

      // Avatar profile click url
      const clickUrl = collab.photoClickUrl || '';
      if (clickUrl) {
        prevAvatarLink.href = clickUrl.startsWith('http') ? clickUrl : 'https://' + clickUrl;
        prevAvatarLink.style.cursor = 'pointer';
      } else {
        prevAvatarLink.href = '#';
        prevAvatarLink.style.cursor = 'default';
      }

      // Avatar profile photo & initials fallback
      if (collab.photoUrl && collab.photoUrl !== '[Photo Base64]') {
        prevAvatarImg.src = collab.photoUrl;
        prevAvatarImg.classList.remove('hidden');
        prevAvatarInitials.classList.add('hidden');
        
        prevAvatarImg.onerror = () => {
          const initials = getCollaboratorInitials(collab.firstName, collab.lastName);
          prevAvatarInitials.textContent = initials;
          prevAvatarInitials.classList.remove('hidden');
          prevAvatarImg.classList.add('hidden');
        };

        // Apply saved database crop properties
        const zoom = collab.photoZoom != null ? parseFloat(collab.photoZoom) : 1.0;
        const x = collab.photoX != null ? parseFloat(collab.photoX) : 50;
        const y = collab.photoY != null ? parseFloat(collab.photoY) : 50;
        
        prevAvatarImg.style.transform = `scale(${zoom})`;
        prevAvatarImg.style.transformOrigin = `${x}% ${y}%`;
      } else {
        const initials = getCollaboratorInitials(collab.firstName, collab.lastName);
        prevAvatarInitials.textContent = initials;
        prevAvatarInitials.classList.remove('hidden');
        prevAvatarImg.classList.add('hidden');
      }

      // Determine active phone number based on select inputs
      const defaultPhoneType = collabPhoneDefaultInput.value;
      let activePhone = '';
      let activeLabel = 'Mobile';
      if (defaultPhoneType === 'work') {
        activePhone = collabPhoneWorkInput.value.trim() || collabPhoneMobileInput.value.trim() || collab.phone || '';
        activeLabel = 'Fixe';
      } else if (defaultPhoneType === 'fax') {
        activePhone = collabPhoneFaxInput.value.trim() || collabPhoneMobileInput.value.trim() || collab.phone || '';
        activeLabel = 'Fax';
      } else {
        activePhone = collabPhoneMobileInput.value.trim() || collab.phone || '';
        activeLabel = 'Mobile';
      }

      // Action Button links
      if (activePhone) {
        prevBtnPhoneText.textContent = `${activeLabel} : ${activePhone}`;
        prevActionPhone.href = `tel:${activePhone}`;
        prevActionPhone.classList.remove('hidden');
      } else {
        prevActionPhone.classList.add('hidden');
      }

      if (collab.email) {
        prevActionEmail.href = `mailto:${collab.email}`;
        prevBtnEmailText.textContent = `Email : ${collab.email}`;
        prevActionEmail.classList.remove('hidden');
      } else {
        prevActionEmail.classList.add('hidden');
      }

      const urlId = collab.customSlug || collab.id;
      prevActionVcard.href = `${API_BASE}/collaborators/${urlId}/vcf`;
      btnExportZip.href = `${API_BASE}/collaborators/${urlId}/export?token=${authToken}`;

      // Sharing Panel Info
      let publicUrlBase = PUBLIC_URL_BASE;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (serverLocalIP && serverLocalIP !== 'localhost') {
          publicUrlBase = `${window.location.protocol}//${serverLocalIP}:3000`;
        }
      }
      const publicUrl = `${publicUrlBase}/card/${urlId}`;
      collabPublicUrl.value = publicUrl;
      collabQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`;
    } else {
      sharingPanel.classList.add('hidden');

      prevCollabName.textContent = '';
      prevCollabRole.textContent = '';
      prevCollabRole.classList.remove('hidden');
      
      // Address formatting & fallback for company
      const formattedAddr = buildFormattedAddress(
        '',
        companyAddressInput ? companyAddressInput.value : '',
        companyZipInput ? companyZipInput.value : '',
        companyCityInput ? companyCityInput.value : '',
        companyCountryInput ? companyCountryInput.value : ''
      );

      if (formattedAddr) {
        prevCollabAddress.innerHTML = formattedAddr;
        prevCollabAddress.classList.remove('hidden');
      } else {
        prevCollabAddress.innerHTML = '';
        prevCollabAddress.classList.add('hidden');
      }

      prevAvatarLink.href = '#';
      prevAvatarLink.style.cursor = 'default';

      // Circle of photo empty (blank)
      prevAvatarImg.classList.add('hidden');
      prevAvatarInitials.textContent = '';
      prevAvatarInitials.classList.remove('hidden');

      // Action Buttons dummy
      prevBtnPhoneText.textContent = 'Mobile';
      prevActionPhone.href = '#';
      prevActionPhone.classList.remove('hidden');
      prevActionEmail.href = '#';
      prevBtnEmailText.textContent = 'Email';
      prevActionEmail.classList.remove('hidden');
      prevActionVcard.href = '#';
      btnExportZip.href = '#';
    }

    // Apply company avatar size
    const avatarSize = companyAvatarSizeInput ? parseInt(companyAvatarSizeInput.value, 10) : 100;
    if (prevAvatarWrapper) {
      prevAvatarWrapper.style.width = `${avatarSize}px`;
      prevAvatarWrapper.style.height = `${avatarSize}px`;
    }
    if (prevAvatarInitials) {
      prevAvatarInitials.style.fontSize = `${avatarSize * 0.35}px`;
    }

    // Company Logo
    cardLogo.src = logoCustomUrl || logoFetchedUrl || getFallbackLogoSVG(companyNameInput.value.trim());
    const companyDomain = companyDomainInput.value.trim();
    prevCompanyLogoLink.href = companyDomain ? (companyDomain.startsWith('http') ? companyDomain : 'https://' + companyDomain) : '#';

    // Apply logo sizing
    const logoSize = companyLogoSizeInput.value;
    const logoContainer = cardLogo.closest('.preview-brand-header');
    if (logoContainer) {
      logoContainer.style.height = 'auto';
    }
    cardLogo.style.height = `${logoSize}px`;
    cardLogo.style.maxWidth = `${logoSize * 3.5}px`;

    // Apply logo X position
    const logoXVal = companyLogoXInput ? parseInt(companyLogoXInput.value, 10) : 0;
    if (prevCompanyLogoLink) {
      prevCompanyLogoLink.style.transform = `translateX(${logoXVal}px)`;
    }

    // Apply company name under logo visibility in preview
    if (companyShowNameInput && companyShowNameInput.checked) {
      if (prevCompanyNameUnderLogo) {
        prevCompanyNameUnderLogo.textContent = companyNameInput.value.trim() || 'TDConnect';
        prevCompanyNameUnderLogo.classList.remove('hidden');
      }
    } else {
      if (prevCompanyNameUnderLogo) {
        prevCompanyNameUnderLogo.classList.add('hidden');
      }
    }

    // Toggle button style classes
    const prevActionsContainer = document.getElementById('prev-actions-container');
    if (prevActionsContainer) {
      if (currentButtonStyle === 'round') {
        prevActionsContainer.classList.add('round');
      } else {
        prevActionsContainer.classList.remove('round');
      }
    }

    // Apply custom message under footer in preview
    if (companyShowMessageInput && companyShowMessageInput.checked) {
      if (prevCompanyMessageUnderFooter) {
        const msgText = companyMessageTextInput ? companyMessageTextInput.value.trim() : '';
        const msgUrl = companyMessageUrlInput ? companyMessageUrlInput.value.trim() : '';
        if (msgText) {
          if (msgUrl) {
            const targetUrl = msgUrl.startsWith('http') ? msgUrl : 'https://' + msgUrl;
            prevCompanyMessageUnderFooter.innerHTML = `<a href="${targetUrl}" target="_blank" style="color: inherit; text-decoration: underline; cursor: pointer;">${msgText}</a>`;
          } else {
            prevCompanyMessageUnderFooter.textContent = msgText;
          }
          prevCompanyMessageUnderFooter.classList.remove('hidden');
        } else {
          prevCompanyMessageUnderFooter.classList.add('hidden');
        }
      }
    } else {
      if (prevCompanyMessageUnderFooter) {
        prevCompanyMessageUnderFooter.classList.add('hidden');
      }
    }
  }

  // Copy Link with fallback for non-secure HTTP contexts (IP addresses)
  btnCopyUrl.addEventListener('click', () => {
    const textToCopy = collabPublicUrl.value;
    if (!textToCopy) return;

    const showSuccess = () => {
      btnCopyUrl.classList.add('copied');
      btnCopyUrl.querySelector('span').textContent = 'Copié !';
      setTimeout(() => {
        btnCopyUrl.classList.remove('copied');
        btnCopyUrl.querySelector('span').textContent = 'Copier';
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(showSuccess)
        .catch(err => {
          console.warn("Clipboard API failed, trying fallback:", err);
          fallbackCopyText(textToCopy, showSuccess);
        });
    } else {
      fallbackCopyText(textToCopy, showSuccess);
    }
  });

  function fallbackCopyText(text, callback) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        if (callback) callback();
      } else {
        console.error('execCommand copy was unsuccessful');
        alert("Sélectionnez le texte et copiez-le manuellement.");
      }
    } catch (err) {
      console.error('Fallback copy error:', err);
      alert("Sélectionnez le texte et copiez-le manuellement.");
    }

    document.body.removeChild(textArea);
  }

  // Render Collaborators UI List
  function renderCollaboratorsList(filterQuery = '') {
    collabListContainer.innerHTML = '';
    
    // Update summary counts
    const countTotalEl = document.getElementById('collab-count-total');
    const countInactiveEl = document.getElementById('collab-count-inactive');
    const totalCount = collaborators.length;
    const inactiveCount = collaborators.filter(c => c.isActive === 0 || c.is_active === 0).length;

    if (countTotalEl) {
      countTotalEl.textContent = `${totalCount} collaborateur(s)`;
    }
    if (countInactiveEl) {
      countInactiveEl.textContent = `${inactiveCount} inactif(s)`;
      if (inactiveCount > 0) {
        countInactiveEl.style.color = 'var(--danger-color)';
      } else {
        countInactiveEl.style.color = 'var(--text-secondary)';
      }
    }

    if (collaborators.length === 0) {
      collabListContainer.innerHTML = '<p class="empty-list-msg">Aucun collaborateur créé pour le moment.</p>';
      selectedCollabId = null;
      updateMockupPreview();
      return;
    }

    // Sort collaborators by Nom (lastName) ASC, then Prénom (firstName) ASC
    const sorted = [...collaborators].sort((a, b) => {
      const lastA = (a.lastName || '').toLowerCase();
      const lastB = (b.lastName || '').toLowerCase();
      if (lastA < lastB) return -1;
      if (lastA > lastB) return 1;
      const firstA = (a.firstName || '').toLowerCase();
      const firstB = (b.firstName || '').toLowerCase();
      if (firstA < firstB) return -1;
      if (firstA > firstB) return 1;
      return 0;
    });

    const q = filterQuery.toLowerCase().trim();
    const filtered = sorted.filter(collab => {
      if (!q) return true;
      const nameLastFirst = `${collab.lastName} ${collab.firstName}`.toLowerCase();
      const nameFirstLast = `${collab.firstName} ${collab.lastName}`.toLowerCase();
      const role = (collab.role || '').toLowerCase();
      return nameLastFirst.includes(q) || nameFirstLast.includes(q) || role.includes(q);
    });

    if (filtered.length === 0) {
      collabListContainer.innerHTML = '<p class="empty-list-msg">Aucun collaborateur correspondant.</p>';
      return;
    }

    filtered.forEach(collab => {
      const isSelected = collab.id === selectedCollabId;
      const collabItem = document.createElement('div');
      collabItem.className = `collab-item ${isSelected ? 'active' : ''} ${collab.isActive === 0 ? 'inactive' : ''}`;
      
      const statusIcon = collab.isActive !== 0 
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` 
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

      const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
      const connectionCountVal = collab.connectionCount != null ? collab.connectionCount : 0;
      const connBadgeHTML = isSuperAdmin
        ? `<span class="collab-item-counter" title="${connectionCountVal} connexion(s) à cette carte" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; font-weight: 700; background: rgba(99, 102, 241, 0.12); color: var(--accent); padding: 0.15rem 0.5rem; border-radius: 12px; margin-top: 0.25rem;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            ${connectionCountVal} connexion(s)
          </span>`
        : '';

      const compIndex = collaborators.findIndex(c => c.id === collab.id) + 1;
      const indexBadgeHTML = `<span class="collab-index-badge" style="font-family: monospace; font-size: 0.72rem; font-weight: 800; background: rgba(140, 82, 255, 0.12); color: var(--accent); padding: 0.15rem 0.45rem; border-radius: 6px; margin-right: 0.4rem; display: inline-block;">N° ${compIndex}</span>`;

      collabItem.innerHTML = `
        <div class="collab-item-info">
          <span class="collab-item-name">${indexBadgeHTML}${collab.lastName.toUpperCase()} ${collab.firstName}</span>
          <span class="collab-item-role">${collab.role || 'Collaborateur'}</span>
          ${connBadgeHTML}
        </div>
        <div class="collab-item-actions">
          <button type="button" class="btn-item-edit" title="Modifier">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          <button type="button" class="btn-item-status ${collab.isActive !== 0 ? 'active' : 'inactive'}" title="${collab.isActive !== 0 ? 'Désactiver' : 'Activer'}">
            ${statusIcon}
          </button>
          <button type="button" class="btn-item-delete" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      collabItem.addEventListener('click', (e) => {
        if (e.target.closest('.btn-item-edit') || e.target.closest('.btn-item-status') || e.target.closest('.btn-item-delete')) {
          return;
        }
        selectCollaborator(collab.id);
      });

      collabItem.querySelector('.btn-item-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openCollabForm(collab);
      });

      collabItem.querySelector('.btn-item-status').addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextActive = collab.isActive !== 0 ? 0 : 1;
        
        // Prepare data with all necessary properties to avoid database errors
        const updatedCollab = { ...collab, isActive: nextActive };
        
        try {
          await apiFetch(`${API_BASE}/collaborators/${collab.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedCollab)
          });
          
          collab.isActive = nextActive;
          const searchVal = searchCollab ? searchCollab.value : '';
          renderCollaboratorsList(searchVal);
          
          if (selectedCollabId === collab.id) {
            updateMockupPreview();
          }
        } catch (err) {
          console.error("Erreur mise à jour statut:", err);
          alert("Erreur lors de la modification du statut.");
        }
      });

      collabItem.querySelector('.btn-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCollaborator(collab.id);
      });

      collabListContainer.appendChild(collabItem);
    });
  }

  function selectCollaborator(id) {
    selectedCollabId = id;
    closeCollabForm();
    const searchVal = searchCollab ? searchCollab.value : '';
    renderCollaboratorsList(searchVal);
    updateMockupPreview();
  }

  function extractSlug(input) {
    if (!input) return '';
    let val = input.toLowerCase().trim();
    
    // If it contains "card/", extract the part after the last "card/"
    if (val.includes('card/')) {
      val = val.substring(val.lastIndexOf('card/') + 5);
    }
    
    // Strip leading slashes
    val = val.replace(/^\/+/, '');
    
    // Sanitize remaining characters (keep only a-z, 0-9, and dashes)
    val = val.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    
    // Remove leading/trailing dashes
    val = val.replace(/^-+|-+$/g, '');
    return val;
  }

  // Form toggling
  function openCollabForm(collab = null) {
    if (collab) {
      selectedCollabId = collab.id;
      const searchVal = searchCollab ? searchCollab.value : '';
      renderCollaboratorsList(searchVal);
      updateMockupPreview();
    }
    collabFormContainer.classList.remove('hidden');
    
    const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
    if (collabConnectionCountGroup) {
      if (isSuperAdmin) {
        collabConnectionCountGroup.classList.remove('hidden');
      } else {
        collabConnectionCountGroup.classList.add('hidden');
      }
    }
    if (collabCustomSlugGroup) {
      if (isSuperAdmin) {
        collabCustomSlugGroup.classList.remove('hidden');
      } else {
        collabCustomSlugGroup.classList.add('hidden');
      }
    }

    if (collab) {
      const compIndex = collaborators.findIndex(c => c.id === collab.id) + 1;
      collabFormTitle.textContent = `Modifier le collaborateur N° ${compIndex}`;
      collabIdInput.value = collab.id;
      if (collabDisplayIdInput) collabDisplayIdInput.value = compIndex;
      if (collabConnectionCountInput) collabConnectionCountInput.value = collab.connectionCount != null ? collab.connectionCount : 0;
      collabFirstnameInput.value = collab.firstName;
      collabLastnameInput.value = collab.lastName;
      collabTitleInput.value = collab.civility || '';
      collabRoleInput.value = collab.role || '';
      collabPhoneInput.value = collab.phone || '';
      collabPhoneMobileInput.value = collab.phoneMobile || '';
      collabPhoneWorkInput.value = collab.phoneWork || '';
      collabPhoneFaxInput.value = collab.phoneFax || '';
      collabPhoneDefaultInput.value = collab.phoneDefault || 'mobile';
      collabEmailInput.value = collab.email;
      collabAddressInput.value = collab.address || '';
      collabPhotoClickUrlInput.value = collab.photoClickUrl || '';
      
      if (collabActiveToggle) {
        collabActiveToggle.checked = collab.isActive !== 0;
        collabActiveLabel.textContent = collabActiveToggle.checked ? 'Actif' : 'Non actif';
        collabActiveLabel.style.color = collabActiveToggle.checked ? 'var(--success-color)' : 'var(--danger-color)';
      }
      
      if (collabCustomSlugInput) collabCustomSlugInput.value = collab.customSlug || '';
      if (collabSlugWarning) collabSlugWarning.style.display = 'none';

      currentCollabPhotoUrl = collab.photoUrl || '';
      if (currentCollabPhotoUrl) {
        collabThumbImg.src = currentCollabPhotoUrl;
        collabPhotoThumb.classList.remove('hidden');
        
        // Pre-fill sliders
        photoFramingControls.classList.remove('hidden');
        collabPhotoZoomInput.value = collab.photoZoom != null ? collab.photoZoom : 1.0;
        collabPhotoXInput.value = collab.photoX != null ? collab.photoX : 50;
        collabPhotoYInput.value = collab.photoY != null ? collab.photoY : 50;
      } else {
        collabPhotoThumb.classList.add('hidden');
        photoFramingControls.classList.add('hidden');
      }
    } else {
      const nextIndex = collaborators.length + 1;
      collabFormTitle.textContent = `Nouveau collaborateur N° ${nextIndex}`;
      collabForm.reset();
      if (collabConnectionCountInput) collabConnectionCountInput.value = 0;
      const newId = 'collab_' + Date.now();
      collabIdInput.value = newId;
      if (collabDisplayIdInput) collabDisplayIdInput.value = nextIndex;
      collabPhoneMobileInput.value = '';
      collabPhoneWorkInput.value = '';
      collabPhoneFaxInput.value = '';
      collabPhoneDefaultInput.value = 'mobile';
      collabPhotoClickUrlInput.value = '';
      
      if (collabActiveToggle) {
        collabActiveToggle.checked = true;
        collabActiveLabel.textContent = 'Actif';
        collabActiveLabel.style.color = 'var(--success-color)';
      }

      if (collabCustomSlugInput) collabCustomSlugInput.value = '';
      if (collabSlugWarning) collabSlugWarning.style.display = 'none';

      currentCollabPhotoUrl = '';
      collabPhotoThumb.classList.add('hidden');
      photoFramingControls.classList.add('hidden');
    }
    collabFirstnameInput.focus();
  }

  function closeCollabForm() {
    collabFormContainer.classList.add('hidden');
    collabForm.reset();
    collabPhotoClickUrlInput.value = '';
    if (collabCustomSlugInput) collabCustomSlugInput.value = '';
    if (collabSlugWarning) collabSlugWarning.style.display = 'none';
    currentCollabPhotoUrl = '';
    collabPhotoThumb.classList.add('hidden');
    photoFramingControls.classList.add('hidden');
  }

  btnAddCollab.addEventListener('click', () => openCollabForm());
  btnCancelCollab.addEventListener('click', closeCollabForm);

  btnSaveCollab.addEventListener('click', async () => {
    const id = collabIdInput.value;
    const firstName = collabFirstnameInput.value.trim();
    const lastName = collabLastnameInput.value.trim();
    const civility = collabTitleInput.value.trim();
    const role = collabRoleInput.value.trim();
    const email = collabEmailInput.value.trim();
    const address = collabAddressInput.value.trim();
    const photoClickUrl = collabPhotoClickUrlInput.value.trim();
    const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
    const collabIndex = collaborators.findIndex(c => c.id === id);
    const customSlug = (collabCustomSlugInput && isSuperAdmin) 
      ? extractSlug(collabCustomSlugInput.value) 
      : (collabIndex > -1 ? (collaborators[collabIndex].customSlug || '') : '');

    const phoneMobile = collabPhoneMobileInput.value.trim();
    const phoneWork = collabPhoneWorkInput.value.trim();
    const phoneFax = collabPhoneFaxInput.value.trim();
    const phoneDefault = collabPhoneDefaultInput.value;

    if (!firstName || !lastName) {
      alert("Veuillez remplir les champs obligatoires (Prénom, Nom).");
      return;
    }

    const connectionCount = (collabConnectionCountInput && currentUser && currentUser.role === 'superadmin')
      ? parseInt(collabConnectionCountInput.value || '0', 10)
      : (collabIndex > -1 ? (collaborators[collabIndex].connectionCount || 0) : 0);

    const collabData = { 
      id, 
      companyId: currentCompanyId,
      firstName, 
      lastName, 
      civility,
      role, 
      phone: phoneMobile || phoneWork || phoneFax, // Fallback legacy field
      email, 
      address, 
      photoUrl: currentCollabPhotoUrl || '',
      photoZoom: currentCollabPhotoUrl ? parseFloat(collabPhotoZoomInput.value) : 1.0,
      photoX: currentCollabPhotoUrl ? parseInt(collabPhotoXInput.value) : 50,
      photoY: currentCollabPhotoUrl ? parseInt(collabPhotoYInput.value) : 50,
      phoneMobile,
      phoneWork,
      phoneFax,
      phoneDefault,
      photoClickUrl,
      isActive: collabActiveToggle ? (collabActiveToggle.checked ? 1 : 0) : 1,
      customSlug,
      connectionCount
    };

    try {
      if (collabIndex > -1) {
        // Edit via PUT API
        await apiFetch(`${API_BASE}/collaborators/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collabData)
        });
        collaborators[collabIndex] = collabData;
      } else {
        // Create via POST API
        await apiFetch(`${API_BASE}/companies/${currentCompanyId}/collaborators`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collabData)
        });
        collaborators.push(collabData);
      }
      closeCollabForm();
      selectCollaborator(id);
    } catch (err) {
      console.error("Erreur de persistance du collaborateur:", err);
      alert("Impossible de sauvegarder le collaborateur dans la base de données.");
    }
  });

  // Delete collaborator in MySQL
  async function deleteCollaborator(id) {
    if (confirm("Voulez-vous vraiment supprimer ce collaborateur ?")) {
      try {
        await apiFetch(`${API_BASE}/collaborators/${id}`, {
          method: 'DELETE'
        });
        
        collaborators = collaborators.filter(c => c.id !== id);
        
        if (selectedCollabId === id) {
          selectedCollabId = collaborators.length > 0 ? collaborators[0].id : null;
        }
        
        const searchVal = searchCollab ? searchCollab.value : '';
        renderCollaboratorsList(searchVal);
        updateMockupPreview();
      } catch (err) {
        console.error("Erreur suppression collaborateur:", err);
        alert("Impossible de supprimer le collaborateur de la base de données.");
      }
    }
  }

  // ==========================================
  // VIEW A: COMPANIES LIST LOGIC
  // ==========================================

  function getOneMonthFromNowDateString() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Toggle company creation inline form
  btnAddCompanyShow.addEventListener('click', () => {
    companyAddFormContainer.classList.toggle('hidden');
    if (newCompanySubscriptionEndInput && !newCompanySubscriptionEndInput.value) {
      newCompanySubscriptionEndInput.value = getOneMonthFromNowDateString();
    }
    newCompanyNameInput.focus();
  });

  btnCancelNewCompany.addEventListener('click', () => {
    companyAddFormContainer.classList.add('hidden');
    newCompanyNameInput.value = '';
    newCompanyDomainInput.value = '';
    if (newCompanySubscriptionEndInput) newCompanySubscriptionEndInput.value = '';
  });

  // Save/Create new company
  btnSaveNewCompany.addEventListener('click', async () => {
    const name = newCompanyNameInput.value.trim();
    const domain = newCompanyDomainInput.value.trim().toLowerCase();
    const subEndDate = (newCompanySubscriptionEndInput && newCompanySubscriptionEndInput.value)
      ? newCompanySubscriptionEndInput.value
      : getOneMonthFromNowDateString();

    if (!name) {
      alert("Veuillez renseigner le nom de l'entreprise.");
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domain,
          subscription_end_date: subEndDate
        })
      });
      const newCompany = await res.json();
      
      companyAddFormContainer.classList.add('hidden');
      newCompanyNameInput.value = '';
      newCompanyDomainInput.value = '';
      if (newCompanySubscriptionEndInput) newCompanySubscriptionEndInput.value = '';
      
      // Reload and immediately select the new company
      await loadCompaniesList();
      loadCompanyDetail(newCompany.id);
    } catch (err) {
      console.error("Erreur lors de la création de l'entreprise:", err);
      alert("Erreur réseau lors de la création de l'entreprise.");
    }
  });

  // Load companies list from MySQL
  async function loadCompaniesList() {
    if (currentUser && currentUser.role === 'superadmin') {
      if (btnAddCompanyShow) btnAddCompanyShow.classList.remove('hidden');
      if (btnAdminPanelShow) btnAdminPanelShow.classList.remove('hidden');
    } else {
      if (btnAddCompanyShow) btnAddCompanyShow.classList.add('hidden');
      if (btnAdminPanelShow) btnAdminPanelShow.classList.add('hidden');
    }

    try {
      const res = await apiFetch(`${API_BASE}/companies`);
      allCompanies = await res.json();

      if (!Array.isArray(allCompanies)) {
        throw new Error(allCompanies.error || "Format de réponse invalide.");
      }
      
      const searchVal = searchCompany ? searchCompany.value.toLowerCase().trim() : '';
      renderCompaniesList(allCompanies, searchVal);
    } catch (err) {
      console.error("Erreur chargement entreprises:", err);
      const msg = err.message || "Erreur réseau lors de la récupération.";
      companiesGrid.innerHTML = `<p class="empty-list-msg" style="color:#f43f5e;">${msg}</p>`;
    }
  }

  function renderCompaniesList(list, searchVal = '') {
    companiesGrid.innerHTML = '';
    
    const filtered = list.filter(company => {
      if (!searchVal) return true;
      const name = company.name.toLowerCase();
      const domain = (company.domain || '').toLowerCase();
      return name.includes(searchVal) || domain.includes(searchVal);
    });

    if (filtered.length === 0) {
      companiesGrid.innerHTML = searchVal
        ? '<p class="empty-list-msg">Aucune entreprise correspondante.</p>'
        : '<p class="empty-list-msg">Aucune entreprise enregistrée.</p>';
      return;
    }

    filtered.forEach(company => {
      const card = document.createElement('div');
      card.className = 'company-list-card';
      card.dataset.id = company.id;

      // Logo : uniquement le logo uploadé manuellement
      let logoSrc = company.logo_custom_url || '';

      let imgHtml = '';
      if (logoSrc) {
        imgHtml = `<img src="${logoSrc}" alt="${company.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                   <span class="company-logo-initials" style="display:none;">${company.name[0].toUpperCase()}</span>`;
      } else {
        imgHtml = `<span class="company-logo-initials">${company.name[0].toUpperCase()}</span>`;
      }

      // Active / Inactive collaborator counts
      const activeCount = company.active_collabs_count != null ? company.active_collabs_count : 0;
      const inactiveCount = company.inactive_collabs_count != null ? company.inactive_collabs_count : 0;

      // Subscription End Date
      const rawSubDate = company.subscriptionEndDate || company.subscription_end_date;
      let formattedSubDate = 'Non définie';
      let isDateExpired = false;
      if (rawSubDate) {
        const parts = String(rawSubDate).split('T')[0].split('-');
        if (parts.length === 3) {
          formattedSubDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          formattedSubDate = String(rawSubDate);
        }
        const todayStr = new Date().toISOString().split('T')[0];
        if (String(rawSubDate).split('T')[0] < todayStr) {
          isDateExpired = true;
        }
      }

      // Access Status (Accès suspendu / Accès actif / Abonnement échu)
      const isSuspended = company.is_subscription_active === 0 || company.isSubscriptionActive === 0;
      let statusBadgeHtml = '';
      if (isSuspended) {
        statusBadgeHtml = `<span class="company-meta-badge status-suspended" style="background: rgba(244, 63, 94, 0.12); color: #e11d48; border: 1px solid rgba(244, 63, 94, 0.25); padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">⛔ Accès suspendu</span>`;
      } else if (isDateExpired) {
        statusBadgeHtml = `<span class="company-meta-badge status-expired" style="background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25); padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">⚠️ Abonnement échu</span>`;
      } else {
        statusBadgeHtml = `<span class="company-meta-badge status-active" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">🟢 Accès actif</span>`;
      }

      card.innerHTML = `
        <div class="company-logo-thumb-wrapper">
          ${imgHtml}
        </div>
        <div class="company-card-info" style="flex-grow: 1; display: flex; flex-direction: column; gap: 0.35rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
            <span class="company-card-name" style="font-size: 1.02rem; font-weight: 700;">${company.name}</span>
            <span class="company-card-domain" style="font-size: 0.8rem; color: var(--text-muted);">${company.domain || 'Sans site web'}</span>
          </div>

          <div class="company-card-meta-row" style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.15rem; font-size: 0.78rem;">
            <span class="company-meta-badge active-collabs" style="background: rgba(16, 185, 129, 0.12); color: #059669; padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
              👥 ${activeCount} actif(s)
            </span>
            <span class="company-meta-badge inactive-collabs" style="background: rgba(148, 163, 184, 0.15); color: #64748b; padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
              ${inactiveCount} inactif(s)
            </span>
            <span class="company-meta-badge sub-date" style="background: rgba(99, 102, 241, 0.08); color: #4f46e5; padding: 0.18rem 0.55rem; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem;">
              📅 Fin : ${formattedSubDate}
            </span>
            ${statusBadgeHtml}
          </div>
        </div>
        <button type="button" class="btn-company-delete" title="Supprimer l'entreprise">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      // Hide delete button if not superadmin
      if (currentUser && currentUser.role !== 'superadmin') {
        const delBtn = card.querySelector('.btn-company-delete');
        if (delBtn) delBtn.style.display = 'none';
      }

      // Click on company card to load details
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-company-delete')) {
          return;
        }
        navigateTo(`#company/${company.id}`);
      });

      // Delete company card
      card.querySelector('.btn-company-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCompany(company.id, company.name);
      });

      companiesGrid.appendChild(card);
    });
  }

  async function deleteCompany(id, name) {
    if (confirm(`Voulez-vous vraiment supprimer l'entreprise "${name}" ? Cela supprimera également tous ses collaborateurs de manière permanente.`)) {
      try {
        await apiFetch(`${API_BASE}/companies/${id}`, {
          method: 'DELETE'
        });
        loadCompaniesList();
      } catch (err) {
        console.error("Erreur suppression entreprise:", err);
        alert("Erreur lors de la suppression de l'entreprise.");
      }
    }
  }

  // ==========================================
  // VIEW B: COMPANY DETAIL LOGIC
  // ==========================================

  async function loadCompanyDetail(companyId) {
    currentCompanyId = companyId;
    
    try {
      // 1. Fetch Company Info
      const res = await apiFetch(`${API_BASE}/companies/${companyId}`);
      const companyInfo = await res.json();
      
      activeCompanyTitle.textContent = companyInfo.name;

      const isSuspended = companyInfo.is_subscription_active === 0 || companyInfo.isSubscriptionActive === 0;

      // Update test subscription banner notice (hidden if access is suspended)
      const testBanner = document.getElementById('company-test-banner');
      const testBannerText = document.getElementById('company-test-banner-text');
      if (testBanner && testBannerText) {
        const subDateVal = companyInfo.subscriptionEndDate || companyInfo.subscription_end_date;
        if (!isSuspended && subDateVal) {
          let formattedDate = subDateVal;
          const parts = String(subDateVal).split('T')[0].split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          testBannerText.textContent = `Cette entreprise a été créée dans le cadre d'un test. L'abonnement est offert jusqu'au ${formattedDate}`;
          testBanner.classList.remove('hidden');
        } else {
          testBanner.classList.add('hidden');
        }
      }
      
      // Prefill company inputs
      companyNameInput.value = companyInfo.name || '';
      companyDomainInput.value = companyInfo.domain || '';
      companyAddressInput.value = companyInfo.address || '';
      companyZipInput.value = companyInfo.zip || '';
      companyCityInput.value = companyInfo.city || '';
      companyCountryInput.value = companyInfo.country || '';
      const isSuperAdmin = currentUser && currentUser.role === 'superadmin';
      
      if (companySubscriptionEndInput) {
        companySubscriptionEndInput.value = companyInfo.subscriptionEndDate || companyInfo.subscription_end_date || '';
        companySubscriptionEndInput.disabled = !isSuperAdmin;
        if (!isSuperAdmin) {
          companySubscriptionEndInput.title = "Seul le Super Admin peut modifier la date de fin d'abonnement.";
          companySubscriptionEndInput.style.cursor = 'not-allowed';
          companySubscriptionEndInput.style.opacity = '0.6';
        } else {
          companySubscriptionEndInput.title = '';
          companySubscriptionEndInput.style.cursor = 'pointer';
          companySubscriptionEndInput.style.opacity = '1';
        }
      }

      if (companyIsSubscriptionActiveInput) {
        companyIsSubscriptionActiveInput.checked = isSuspended;
        companyIsSubscriptionActiveInput.disabled = !isSuperAdmin;
        if (!isSuperAdmin) {
          companyIsSubscriptionActiveInput.title = "Seul le Super Admin peut suspendre l'accès de l'entreprise.";
          companyIsSubscriptionActiveInput.style.cursor = 'not-allowed';
          companyIsSubscriptionActiveInput.style.opacity = '0.6';
        } else {
          companyIsSubscriptionActiveInput.title = '';
          companyIsSubscriptionActiveInput.style.cursor = 'pointer';
          companyIsSubscriptionActiveInput.style.opacity = '1';
        }
      }
      
      const logoSizeVal = companyInfo.logo_size !== undefined ? companyInfo.logo_size : 72;
      if (companyLogoSizeInput) companyLogoSizeInput.value = logoSizeVal;
      if (companyLogoSizeVal) companyLogoSizeVal.textContent = `${logoSizeVal}px`;

      if (companyLogoXInput && companyLogoXVal) {
        const logoXVal = companyInfo.logo_x != null ? companyInfo.logo_x : 0;
        companyLogoXInput.value = logoXVal;
        companyLogoXVal.textContent = `${logoXVal > 0 ? '+' : ''}${logoXVal}px`;
      }
      
      if (companyAvatarSizeInput && companyAvatarSizeVal) {
        const avatarSizeVal = companyInfo.avatar_size != null ? companyInfo.avatar_size : 100;
        companyAvatarSizeInput.value = avatarSizeVal;
        companyAvatarSizeVal.textContent = `${avatarSizeVal}px`;
      }

      if (companyShowNameInput) {
        companyShowNameInput.checked = companyInfo.show_name_under_logo !== 0;
      }
      
      if (companyShowMessageInput) {
        companyShowMessageInput.checked = companyInfo.show_tdconnect_message !== 0;
      }
      if (companyMessageTextInput) {
        companyMessageTextInput.value = companyInfo.tdconnect_message || '';
      }
      if (companyMessageUrlInput) {
        companyMessageUrlInput.value = companyInfo.tdconnect_url || companyInfo.tdconnectUrl || '';
      }
      if (companyMessageContainer) {
        if (companyInfo.show_tdconnect_message !== 0) {
          companyMessageContainer.classList.remove('hidden');
        } else {
          companyMessageContainer.classList.add('hidden');
        }
      }
      
      logoCustomUrl = companyInfo.logo_custom_url || '';
      currentTheme = companyInfo.theme || 'theme-glass';
      currentFont = companyInfo.font || 'font-outfit';
      currentAccentColor = companyInfo.accent_color || '#8C52FF';

      currentButtonStyle = companyInfo.button_style || 'rectangle';

      // Update Radio checks
      const matchingRadio = document.querySelector(`input[name="card-theme"][value="${currentTheme}"]`);
      if (matchingRadio) matchingRadio.checked = true;

      const matchingBtnRadio = document.querySelector(`input[name="company-btn-style"][value="${currentButtonStyle}"]`);
      if (matchingBtnRadio) matchingBtnRadio.checked = true;
      
      // Update font classes
      fontButtons.forEach(b => {
        if (b.dataset.font === currentFont) b.classList.add('active');
        else b.classList.remove('active');
      });
      
      // Update Swatches
      colorSwatches.forEach(s => {
        if (s.dataset.color === currentAccentColor) s.classList.add('active');
        else s.classList.remove('active');
      });
      customColorInput.value = currentAccentColor;

      // Update mockup elements classes
      cardElement.className = `virtual-card-preview ${currentTheme} ${currentFont}`;
      cardElement.style.setProperty('--accent-color', currentAccentColor);

      // Handle custom logo preview thumb
      if (logoCustomUrl) {
        if (thumbImg) thumbImg.src = logoCustomUrl;
        const thumbNameEl = document.querySelector('.thumb-name');
        if (thumbNameEl) thumbNameEl.textContent = "logo_charge.png";
        if (logoPreviewThumb) logoPreviewThumb.classList.remove('hidden');
      } else {
        if (logoPreviewThumb) logoPreviewThumb.classList.add('hidden');
      }

      updateCompanyPreview();

      // 2. Fetch Company Collaborators
      const collabRes = await apiFetch(`${API_BASE}/companies/${companyId}/collaborators`);
      collaborators = await collabRes.json();
      
      if (collaborators.length > 0) {
        selectedCollabId = collaborators[0].id;
      } else {
        selectedCollabId = null;
      }

      if (searchCollab) searchCollab.value = '';
      renderCollaboratorsList();
      updateMockupPreview();

      // Switch to company detail view
      viewCompaniesList.classList.add('hidden');
      viewCompanyDetail.classList.remove('hidden');
      updateLayoutMode();
      
      // Default tab to company on detail entry
      const tabBtnCompany = document.querySelector('.tab-btn[data-tab="tab-company"]');
      if (tabBtnCompany) tabBtnCompany.click();

    } catch (err) {
      console.error("Erreur de chargement des détails de l'entreprise:", err);
      alert(err.message || "Impossible de charger cette entreprise.");
      navigateTo('#dashboard');
    }
  }

  // Back button click
  btnBackToList.addEventListener('click', () => {
    currentCompanyId = null;
    collaborators = [];
    selectedCollabId = null;

    closeCollabForm();
    updateMockupPreview();
    navigateTo('#dashboard');
  });

  // Logo size slider change
  companyLogoSizeInput.addEventListener('input', () => {
    companyLogoSizeVal.textContent = `${companyLogoSizeInput.value}px`;
    updateCompanyPreview();
  });

  // Logo X offset slider change
  if (companyLogoXInput) {
    companyLogoXInput.addEventListener('input', () => {
      const val = companyLogoXInput.value;
      companyLogoXVal.textContent = `${val > 0 ? '+' : ''}${val}px`;
      updateCompanyPreview();
    });
  }

  // Button style radio change
  companyBtnStyleRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentButtonStyle = e.target.value;
      updateCompanyPreview();
    });
  });

  // Collab phone inputs synchro for real-time preview
  [collabPhoneMobileInput, collabPhoneWorkInput, collabPhoneFaxInput].forEach(input => {
    input.addEventListener('input', () => {
      updateMockupPreview();
    });
  });
  collabPhoneDefaultInput.addEventListener('change', () => {
    updateMockupPreview();
  });

  // --- Excel Import/Export Logic ---

  if (btnExcelExport) {
    btnExcelExport.addEventListener('click', () => {
      console.log('Export Excel cliqué', { currentCompanyId, collaboratorsCount: collaborators.length });
      try {
        if (!currentCompanyId) {
          alert("Veuillez sélectionner une entreprise d'abord.");
          return;
        }
        if (collaborators.length === 0) {
          alert("Aucun collaborateur à exporter pour cette entreprise.");
          return;
        }

        const companyNameVal = activeCompanyTitle ? activeCompanyTitle.textContent.trim() : 'Entreprise';

        const dataToExport = collaborators.map((c, index) => ({
          'Nom de l\'entreprise': companyNameVal,
          'N° Index': index + 1,
          'Civilité': c.civility || '',
          'Prénom': c.firstName || '',
          'Nom': c.lastName || '',
          'Poste / Fonction': c.role || '',
          'Email': c.email || '',
          'Téléphone Mobile': c.phoneMobile || '',
          'Téléphone Fixe': c.phoneWork || '',
          'Fax': c.phoneFax || '',
          'Téléphone par Défaut': c.phoneDefault || 'mobile',
          'Adresse': c.address || '',
          'Lien Clic Photo': c.photoClickUrl || '',
          'Lien Web Personnalisé': c.customSlug || '',
          'Photo URL': (c.photoUrl && c.photoUrl.startsWith('data:')) ? '[Photo Base64]' : (c.photoUrl || ''),
          'Zoom Photo': c.photoZoom != null ? c.photoZoom : 1.0,
          'Position X': c.photoX != null ? c.photoX : 50,
          'Position Y': c.photoY != null ? c.photoY : 50,
          'Taille Cercle Photo': c.avatarSize != null ? c.avatarSize : 100,
          'Actif': c.isActive !== 0 ? 'Oui' : 'Non'
        }));

        console.log('Données d\'export préparées', dataToExport);

        if (typeof utils === 'undefined' || typeof writeFile === 'undefined') {
          throw new Error("La bibliothèque Excel (SheetJS) n'est pas chargée correctement.");
        }

        const worksheet = utils.json_to_sheet(dataToExport);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Collaborateurs');

        const compName = activeCompanyTitle ? activeCompanyTitle.textContent.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'entreprise';
        console.log('Écriture du fichier Excel', compName);
        writeFile(workbook, `collaborateurs_${compName}.xlsx`);
      } catch (err) {
        console.error("Erreur lors de l'export Excel:", err);
        alert("Erreur lors de l'export Excel : " + err.message);
      }
    });
  }

  if (btnExcelImport) {
    btnExcelImport.addEventListener('click', () => {
      if (!currentCompanyId) {
        alert("Veuillez sélectionner une entreprise d'abord.");
        return;
      }
      excelImportFile.click();
    });
  }

  if (excelImportFile) {
    excelImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          
          if (typeof read === 'undefined' || typeof utils === 'undefined') {
            throw new Error("La bibliothèque Excel (SheetJS) n'est pas chargée correctement.");
          }

          const workbook = read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = utils.sheet_to_json(sheet);

          if (rows.length === 0) {
            alert("Le fichier Excel est vide.");
            return;
          }

          const headerMapping = {
            'n° index (id)': 'importedIndex', 'n° index': 'importedIndex', 'id / index': 'importedIndex', 'index': 'importedIndex', 'n°d\'index': 'importedIndex', 'numéro index': 'importedIndex', 'n° id': 'importedIndex', 'id': 'importedIndex', 'id unique': 'importedIndex',
            'prénom': 'firstName', 'prenom': 'firstName', 'firstname': 'firstName', 'first_name': 'firstName', 'first name': 'firstName',
            'nom': 'lastName', 'lastname': 'lastName', 'last_name': 'lastName', 'last name': 'lastName', 'nom de famille': 'lastName',
            'civilité': 'civility', 'civilite': 'civility', 'civility': 'civility', 'titre': 'civility', 'title': 'civility',
            'poste': 'role', 'fonction': 'role', 'role': 'role', 'rôle': 'role', 'title': 'role', 'job': 'role', 'poste / fonction': 'role', 'poste/fonction': 'role',
            'email': 'email', 'e_mail': 'email', 'e-mail': 'email', 'courriel': 'email', 'adresse e-mail': 'email', 'adresse email': 'email', 'mail': 'email',
            'adresse': 'address', 'address': 'address', 'adresse postale': 'address',
            'mobile': 'phoneMobile', 'portable': 'phoneMobile', 'téléphone mobile': 'phoneMobile', 'telephone mobile': 'phoneMobile', 'phone_mobile': 'phoneMobile', 'phonemobile': 'phoneMobile', 'tel mobile': 'phoneMobile', 'tél mobile': 'phoneMobile', 'tel_mobile': 'phoneMobile',
            'fixe': 'phoneWork', 'téléphone fixe': 'phoneWork', 'telephone fixe': 'phoneWork', 'phone_work': 'phoneWork', 'phonework': 'phoneWork', 'tel fixe': 'phoneWork', 'tél fixe': 'phoneWork', 'tel_fixe': 'phoneWork', 'bureau': 'phoneWork',
            'fax': 'phoneFax', 'téléphone fax': 'phoneFax', 'telephone fax': 'phoneFax', 'phone_fax': 'phoneFax', 'phonefax': 'phoneFax',
            'téléphone par défaut': 'phoneDefault', 'telephone par defaut': 'phoneDefault', 'phone_default': 'phoneDefault', 'phonedefault': 'phoneDefault', 'tel par defaut': 'phoneDefault',
            'lien clic photo': 'photoClickUrl', 'photo_click_url': 'photoClickUrl', 'photoclickurl': 'photoClickUrl',
            'photo url': 'photoUrl', 'photo_url': 'photoUrl', 'photourl': 'photoUrl', 'photo': 'photoUrl',
            'zoom photo': 'photoZoom', 'photo_zoom': 'photoZoom', 'photozoom': 'photoZoom',
            'position x': 'photoX', 'photo_x': 'photoX', 'photox': 'photoX',
            'position y': 'photoY', 'photo_y': 'photoY', 'photoy': 'photoY',
            'lien web personnalisé': 'customSlug', 'custom_slug': 'customSlug', 'customslug': 'customSlug', 'lien_web_personnalisé': 'customSlug', 'slug': 'customSlug', 'url': 'customSlug',
            'taille cercle photo': 'avatarSize', 'avatar_size': 'avatarSize', 'avatarsize': 'avatarSize', 'taille_cercle_photo': 'avatarSize',
            'actif': 'isActive', 'is_active': 'isActive', 'isactive': 'isActive', 'statut': 'isActive'
          };

          const validCollabs = [];
          let rowIndex = 0;
          for (const row of rows) {
            rowIndex++;
            const collab = {
              id: 'collab_' + Date.now() + '_' + rowIndex + '_' + Math.random().toString(36).substring(2, 9),
              companyId: currentCompanyId,
              importedIndex: '',
              firstName: '', lastName: '', civility: '', role: '', phone: '', email: '',
              address: '', photoUrl: '', photoZoom: 1.0, photoX: 50, photoY: 50,
              phoneMobile: '', phoneWork: '', phoneFax: '', phoneDefault: 'mobile',
              photoClickUrl: '', isActive: 1, customSlug: '', avatarSize: 100
            };

            for (const key of Object.keys(row)) {
              const cleanKey = key.toLowerCase().trim();
              const targetField = headerMapping[cleanKey];
              if (targetField) {
                let val = row[key];
                if (targetField === 'photoZoom') val = parseFloat(val) || 1.0;
                else if (targetField === 'photoX' || targetField === 'photoY' || targetField === 'avatarSize') {
                  val = parseInt(val, 10) || (targetField === 'avatarSize' ? 100 : 50);
                } else if (targetField === 'isActive') {
                  const s = String(val).toLowerCase().trim();
                  val = (s === 'oui' || s === 'true' || s === '1' || s === 'actif' || s === 'y' || s === 'yes') ? 1 : 0;
                } else {
                  val = String(val).trim();
                }
                collab[targetField] = val;
              }
            }

            // Validation logic: require at least Prénom and Nom
            if (collab.firstName && collab.lastName) {
              if (!collab.role) collab.role = 'Collaborateur';

              // ONLY N° Index is used to identify an existing collaborator for UPDATE
              const rawIndexVal = (collab.importedIndex || '').trim();
              if (rawIndexVal) {
                const parsedIndex = parseInt(rawIndexVal, 10);
                let existing = null;
                if (!isNaN(parsedIndex) && parsedIndex > 0) {
                  // Match by 1-based sequential index in this company
                  existing = collaborators[parsedIndex - 1] || null;
                }
                if (!existing) {
                  // Fallback match by internal string ID (collab_...)
                  existing = collaborators.find(c => c.id === rawIndexVal) || null;
                }

                if (existing) {
                  collab.id = existing.id;
                  // Preserve photo if imported is empty or placeholder
                  if (!collab.photoUrl || collab.photoUrl === '[Photo Base64]' || collab.photoUrl.startsWith('[')) {
                    collab.photoUrl = existing.photoUrl || '';
                  }
                }
              }

              // Set default legacy phone field
              collab.phone = collab.phoneMobile || collab.phoneWork || collab.phoneFax || '';
              validCollabs.push(collab);
            }
          }

          if (validCollabs.length === 0) {
            alert("Aucun collaborateur valide trouvé dans le fichier Excel (Champs requis au minimum : Prénom et Nom).");
            return;
          }

          // Disable button during loading
          btnExcelImport.disabled = true;
          const btnSpan = btnExcelImport.querySelector('span');
          if (btnSpan) btnSpan.textContent = 'Importation...';

          // Sequential save to avoid race conditions or ID collisions
          for (const c of validCollabs) {
            const isEdit = collaborators.some(ex => ex.id === c.id);
            const url = isEdit ? `${API_BASE}/collaborators/${c.id}` : `${API_BASE}/companies/${currentCompanyId}/collaborators`;
            const method = isEdit ? 'PUT' : 'POST';
            
            await apiFetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(c)
            });
          }

          // Refresh list from DB
          const collabRes = await apiFetch(`${API_BASE}/companies/${currentCompanyId}/collaborators`);
          collaborators = await collabRes.json();
          
          const searchVal = searchCollab ? searchCollab.value : '';
          renderCollaboratorsList(searchVal);
          
          if (collaborators.length > 0 && (!selectedCollabId || !collaborators.some(c => c.id === selectedCollabId))) {
            selectCollaborator(collaborators[0].id);
          } else {
            updateMockupPreview();
          }

          alert(`${validCollabs.length} collaborateur(s) importé(s) / mis à jour avec succès !`);
        } catch (err) {
          console.error("Erreur lors de la lecture du fichier Excel:", err);
          alert("Erreur lors de la lecture ou du traitement du fichier Excel.");
        } finally {
          btnExcelImport.disabled = false;
          const btnSpan = btnExcelImport.querySelector('span');
          if (btnSpan) btnSpan.textContent = 'Import Excel';
          excelImportFile.value = '';
        }
      };

      reader.readAsArrayBuffer(file);
    });
  }

  // --- Search input event listeners ---
  if (searchCompany) {
    searchCompany.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase().trim();
      renderCompaniesList(allCompanies, val);
    });
  }

  if (searchCollab) {
    searchCollab.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase().trim();
      renderCollaboratorsList(val);
    });
  }

  if (collabActiveToggle) {
    collabActiveToggle.addEventListener('change', () => {
      const active = collabActiveToggle.checked;
      collabActiveLabel.textContent = active ? 'Actif' : 'Non actif';
      collabActiveLabel.style.color = active ? 'var(--success-color)' : 'var(--danger-color)';
    });
  }

  if (collabCustomSlugInput) {
    let checkTimeout = null;

    collabCustomSlugInput.addEventListener('blur', (e) => {
      e.target.value = extractSlug(e.target.value);
    });

    collabCustomSlugInput.addEventListener('input', (e) => {
      let val = e.target.value.toLowerCase();
      
      // If it looks like a URL, extract slug immediately
      if (val.includes('/') || val.includes('.')) {
        val = extractSlug(val);
      } else {
        // Just remove forbidden characters
        val = val.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      }
      e.target.value = val;

      const slug = val.trim();
      const currentId = collabIdInput ? collabIdInput.value : '';

      if (checkTimeout) clearTimeout(checkTimeout);
      if (!slug) {
        collabSlugWarning.style.display = 'none';
        return;
      }

      checkTimeout = setTimeout(async () => {
        try {
          const res = await apiFetch(`${API_BASE}/collaborators/check-slug/${slug}?excludeId=${currentId}`);
          const data = await res.json();
          if (data.available === false) {
            collabSlugWarning.textContent = `Attention : Ce lien public est déjà attribué à ${data.owner} !`;
            collabSlugWarning.style.display = 'block';
          } else {
            collabSlugWarning.style.display = 'none';
          }
        } catch (err) {
          console.error("Erreur vérification slug:", err);
        }
      }, 350);
    });
  }

  // --- Router Event Listeners & Initial Loading ---
  window.addEventListener('popstate', (e) => {
    const hash = (e.state && e.state.hash) || window.location.hash || '#home';
    renderRoute(hash);
  });

  window.addEventListener('hashchange', () => {
    renderRoute(window.location.hash);
  });

  setupPasswordToggles();

  if (authToken && currentUser) {
    const initialHash = window.location.hash || '#dashboard';
    navigateTo(initialHash, false);
  } else {
    const initialHash = window.location.hash || '#home';
    navigateTo(initialHash, false);
  }
});
