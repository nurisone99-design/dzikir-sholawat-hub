import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error("React Error Boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg text-center">
            <h1 className="text-3xl font-bold mb-4">Terjadi Kesalahan</h1>

            <p className="text-muted-foreground mb-6">
              Maaf, aplikasi mengalami kesalahan yang tidak terduga.
            </p>

            <button
              className="px-5 py-2 rounded-lg bg-primary text-white"
              onClick={() => window.location.reload()}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
