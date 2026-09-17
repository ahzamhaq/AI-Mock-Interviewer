import React from 'react';

// Catches render/lifecycle errors in its subtree (Suspense does not).
// `fallback` can be a node, or a function (error) => node for custom messaging.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.state.error);
      if (fallback) return fallback;
      return null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
