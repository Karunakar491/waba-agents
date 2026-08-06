import { Component, type ReactNode } from 'react'
import { extractErrorMessage } from '../../lib/errors'

/**
 * Catches unhandled render errors so one broken page doesn't white-screen
 * the whole app — the sidebar/header stay interactive so the operator can
 * navigate away without a full reload. Wrapped once around AppShell's
 * <Outlet/>, keyed on the route so it resets on navigation.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: unknown
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled render error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p role="alert" className="text-sm text-destructive">
            {extractErrorMessage(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-sm font-medium underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
