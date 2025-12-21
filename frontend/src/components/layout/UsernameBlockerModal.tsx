import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';

export function UsernameBlockerModal() {
    const { user, refreshUser } = useAuth();
    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Only show if user is logged in but has no username
    if (!user || user.username) {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            setIsLoading(false);
            return;
        }

        try {
            await api.users.updateProfile({ username });
            await refreshUser();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set username');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
            <div className="w-full max-w-md p-4">
                <Card className="shadow-2xl">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Username</h2>
                        <p className="text-gray-600">
                            We've updated our platform! Please choose a unique username to continue using Highland Events Hub.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="modal-username" className="block text-sm font-medium text-gray-700 mb-1">
                                Username
                            </label>
                            <Input
                                id="modal-username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. HighlandExplorer"
                                required
                                disabled={isLoading}
                                autoFocus
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                This will be your unique handle on the platform.
                            </p>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            disabled={isLoading || !username}
                        >
                            {isLoading ? 'Saving...' : 'Continue'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
