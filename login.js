const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('login-submit');
const errorMessage = document.getElementById('login-error');
const togglePassword = document.getElementById('toggle-password');

togglePassword.addEventListener('click', () => {
  const showingPassword = passwordInput.type === 'text';
  passwordInput.type = showingPassword ? 'password' : 'text';
  togglePassword.textContent = showingPassword ? 'Mostrar' : 'Ocultar';
  togglePassword.setAttribute('aria-label', showingPassword ? 'Mostrar senha' : 'Ocultar senha');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  submitButton.disabled = true;
  submitButton.innerHTML = 'Entrando <span class="button-spinner" aria-hidden="true"></span>';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: usernameInput.value,
        senha: passwordInput.value
      })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'Não foi possível entrar.');
    }

    window.location.assign('/');
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    passwordInput.select();
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Entrar <span aria-hidden="true">&rarr;</span>';
  }
});
