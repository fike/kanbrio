import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { useAuth } from '../AuthProvider';
import { register, getWorkspaces } from '../../api/auth';

export function Register() {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [nameError, setNameError] = createSignal<string | null>(null);
  const [emailError, setEmailError] = createSignal<string | null>(null);
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const auth = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    let isValid = true;

    if (!name()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError(null);
    }

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
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password())) {
        setPasswordError('Password must be at least 8 characters long and contain at least one letter and one number');
        isValid = false;
      } else {
        setPasswordError(null);
      }
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
      const userProfile = await register({
        name: name(),
        email: email(),
        password: password(),
      });
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
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="register-view"
      class="flex items-center justify-center min-h-screen bg-base p-6"
    >
      <div class="w-full max-w-[400px] p-6 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-6 transition-all duration-300 ease-standard dark:bg-slate-900/50 dark:border-slate-800/80 dark:shadow-xl">
        <div class="flex flex-col gap-1 text-center">
          <h1 class="text-2xl font-semibold tracking-tight text-primary">
            Create an account
          </h1>
          <p class="text-sm leading-5 text-secondary">
            Get started with your Kanbrio account
          </p>
        </div>

        <Show when={formError()}>
          <div
            data-testid="register-error-message"
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
          data-testid="register-credentials-form"
          class="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <div class="flex flex-col gap-1.5">
            <label
              for="name"
              class="text-xs font-semibold text-secondary tracking-wide uppercase select-none"
            >
              Full Name
            </label>
            <input
              data-testid="register-name-input"
              id="name"
              type="text"
              autocomplete="name"
              aria-required="true"
              disabled={submitting()}
              value={name()}
              onInput={(e) => {
                setName(e.currentTarget.value);
                if (nameError()) validate();
              }}
              placeholder="John Doe"
              class="px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary hover:border-secondary/50 disabled:opacity-60 disabled:cursor-not-allowed disabled:select-none disabled:bg-elevated/50"
              classList={{
                'border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40':
                  !!nameError(),
              }}
            />
            <Show when={nameError()}>
              <div role="alert" class="text-xs text-status-blocked font-medium mt-0.5">
                {nameError()}
              </div>
            </Show>
          </div>

          <div class="flex flex-col gap-1.5">
            <label
              for="register-email"
              class="text-xs font-semibold text-secondary tracking-wide uppercase select-none"
            >
              Email Address
            </label>
            <input
              data-testid="register-email-input"
              id="register-email"
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
              for="register-password"
              class="text-xs font-semibold text-secondary tracking-wide uppercase select-none"
            >
              Password
            </label>
            <input
              data-testid="register-password-input"
              id="register-password"
              type="password"
              autocomplete="new-password"
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
            data-testid="register-submit-button"
            type="submit"
            role="button"
            disabled={submitting()}
            class="w-full py-2 bg-accent-primary text-white font-medium text-sm rounded-md hover:bg-accent-primary/95 transition-all duration-150 focus:ring-2 focus:ring-accent-primary/50 focus:outline-none active:scale-[0.98] active:transition-transform active:duration-100 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:select-none disabled:bg-elevated/50"
          >
            <Show when={submitting()}>
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span>Signing up...</span>
            </Show>
            <Show when={!submitting()}>
              <span>Sign Up</span>
            </Show>
          </button>
        </form>

        <div class="text-center">
          <A
            data-testid="login-link"
            href="/login"
            class="text-xs text-secondary hover:text-accent-primary font-medium transition-colors"
          >
            Already have an account? Sign in
          </A>
        </div>
      </div>
    </div>
  );
}
