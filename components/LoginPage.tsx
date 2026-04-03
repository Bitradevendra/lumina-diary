import React, { useState } from 'react';
import { Icons } from '../constants';
import { loginWithGoogle } from '../services/firebase';

const LoginPage: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
            await loginWithGoogle();
            // Auth state listener in App.tsx will handle the redirect/state update
        } catch (e: any) {
            console.error(e);
            if (e.code === 'auth/api-key-not-valid') {
                setError("Configuration Error: Please update firebase.ts with your valid API Key.");
            } else {
                setError("Failed to sign in. Please try again.");
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 md:p-12 text-center border border-stone-100 animate-fade-in">
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                    <Icons.Sparkles className="w-8 h-8 text-white" />
                </div>
                
                <h1 className="font-serif text-3xl font-bold text-stone-800 mb-3">Welcome to Lumina</h1>
                <p className="text-stone-500 mb-8 leading-relaxed">
                    Your personal AI-powered diary for mental clarity and emotional well-being.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <button 
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    )}
                    <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
                
                <div className="mt-8 pt-6 border-t border-stone-100">
                    <p className="text-xs text-stone-400 mb-2">
                        <Icons.Cloud className="w-3 h-3 inline mr-1" />
                        Google Cloud Storage
                    </p>
                    <p className="text-[10px] text-stone-300">
                        All your data is securely stored under your Google account.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;