import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { useAuth } from '../AuthProvider';
import { login, getWorkspaces } from '../../api/auth';

export function Login() {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [emailError, setEmailError] = createSignal<string | null>(null);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const auth = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    let isValid = true;
    if (!email()) {
      setEmailError('Email is required');
      isValid = false;
    } else {
      setEmailError(null);
    }

    if (!password()) {
      setPasswordError('Password is required');
      isValid = false;
    } else {
      setPasswordError(null);
    }

    return isValid;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const userProfile = await login({ email: email(), password: password() });
      auth.setCurrentUser(userProfile);

      const ws = await getWorkspaces();
      auth.setWorkspaces(ws);
      if (ws.length > 0) {
        auth.setActiveWorkspace(ws[0]);
        navigate(`/w/${ws[0].id}`);
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="login-view"
      class="flex items-center justify-center min-h-screen bg-base p-6"
    >
      <div class="w-full max-w-[400px] p-6 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-6 transition-all duration-300 ease-standard dark:bg-slate-900/50 dark:border-slate-800/80 dark:shadow-xl">
        <div class="flex flex-col gap-1 text-center">
          <h1 class="text-2xl font-semibold tracking-tight text-primary">
            Welcome back
          </h1>
          <p class="text-sm leading-5 text-secondary">
            Sign in to your Kanbrio account
          </p>
        </div>

        <div class="flex items-center gap-3">
          <a
            data-testid="oauth-google-button"
            href="/api/auth/login/google"
            role="button"
            aria-label="Sign in with Google"
            class="w-full flex items-center justify-center gap-3 px-4 py-2 border border-base rounded-md font-medium text-sm transition-all duration-150 focus:ring-2 focus:ring-accent-primary/20 focus:outline-none bg-surface hover:bg-elevated active:bg-elevated/80 text-primary dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:active:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700"
          >
            <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.927h6.6c-.29 1.5-1.14 2.77-2.4 3.61v3h3.86c2.26-2.09 3.56-5.17 3.56-8.47z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29a7.18 7.18 0 0 1 0-4.58V6.62H1.29a11.94 11.94 0 0 0 0 10.76l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            <span>Google</span>
          </a>

          <a
            data-testid="oauth-github-button"
            href="/api/auth/login/github"
            role="button"
            aria-label="Sign in with GitHub"
            class="w-full flex items-center justify-center gap-3 px-4 py-2 border border-base rounded-md font-medium text-sm transition-all duration-150 focus:ring-2 focus:ring-accent-primary/20 focus:outline-none bg-slate-900 hover:bg-slate-800 active:bg-black text-white border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-900 dark:text-white dark:border-slate-700"
          >
            <svg class="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            <span>GitHub</span>
          </a>
        </div>

        <div class="w-full flex items-center gap-3 my-2 text-[10px] font-semibold text-tertiary uppercase tracking-wider before:h-px before:flex-1 before:bg-base after:h-px after:flex-1 after:bg-base">
          or continue with
        </div>

        <Show when={formError()}>
          <div
            data-testid="login-error-message"
            role="alert"
            class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start animate-shake"
          >
            <svg
              class="w-4 h-4 text-status-blocked flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{formError()}</span>
          </div>
        </Show>

        <form
          data-testid="login-credentials-form"
          class="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div class="flex flex-col gap-1.5">
            <label
              for="email"
              class="text-xs font-semibold text-secondary tracking-wide uppercase select-none"
            >
              Email Address
            </label>
            <input
              data-testid="login-email-input"
              id="email"
              type="email"
              autocomplete="username"
              aria-required="true"
              disabled={submitting()}
              value={email()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                if (emailError()) validate();
              }}
              placeholder="name@company.com"
              class="px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary hover:border-secondary/50 disabled:opacity-60 disabled:cursor-not-allowed disabled:select-none disabled:bg-elevated/50"
              classList={{
                'border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40':
                  !!emailError(),
              }}
            />
            <Show when={emailError()}>
              <div role="alert" class="text-xs text-status-blocked font-medium mt-0.5">
                {emailError()}
              </div>
            </Show>
          </div>

          <div class="flex flex-col gap-1.5">
            <label
              for="password"
              class="text-xs font-semibold text-secondary tracking-wide uppercase select-none"
            >
              Password
            </label>
            <input
              data-testid="login-password-input"
              id="password"
              type="password"
              autocomplete="current-password"
              aria-required="true"
              disabled={submitting()}
              value={password()}
              onInput={(e) => {
                setPassword(e.currentTarget.value);
                if (passwordError()) validate();
              }}
              placeholder="••••••••"
              class="px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary hover:border-secondary/50 disabled:opacity-60 disabled:cursor-not-allowed disabled:select-none disabled:bg-elevated/50"
              classList={{
                'border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40':
                  !!passwordError(),
              }}
            />
            <Show when={passwordError()}>
              <div role="alert" class="text-xs text-status-blocked font-medium mt-0.5">
                {passwordError()}
              </div>
            </Show>
          </div>

          <button
            data-testid="login-submit-button"
            type="submit"
            role="button"
            disabled={submitting()}
            class="w-full py-2 bg-accent-primary text-white font-medium text-sm rounded-md hover:bg-accent-primary/95 transition-all duration-150 focus:ring-2 focus:ring-accent-primary/50 focus:outline-none active:scale-[0.98] active:transition-transform active:duration-100 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:select-none disabled:bg-elevated/50"
          >
            <Show when={submitting()}>
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span>Signing in...</span>
            </Show>
            <Show when={!submitting()}>
              <span>Sign In</span>
            </Show>
          </button>
        </form>

        <div class="text-center">
          <A
            data-testid="register-link"
            href="/register"
            class="text-xs text-secondary hover:text-accent-primary font-medium transition-colors"
          >
            Don't have an account? Sign up
          </A>
        </div>
      </div>
    </div>
  );
}
