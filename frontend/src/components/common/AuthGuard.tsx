
import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/common/Spinner';
import { toast } from 'react-hot-toast';

interface AuthGuardProps {
    children: ReactNode;
    requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                // Redirect to login if not authenticated
                router.push(`/auth/login?redirect=${router.asPath}`);
            } else if (requireAdmin && !user?.is_admin) {
                // Redirect home if admin required but user is not admin
                toast.error('Unauthorized access');
                router.push('/');
            }
        }
    }, [isLoading, isAuthenticated, user, requireAdmin, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Spinner size="lg" />
            </div>
        );
    }

    // If not authenticated (and verified done loading), don't render children
    // (Effect will handle redirect)
    if (!isAuthenticated) {
        return null;
    }

    // If admin required but not admin, don't render children
    if (requireAdmin && !user?.is_admin) {
        return null;
    }

    return <>{children}</>;
}
