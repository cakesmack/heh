import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { GroupMember } from '@/types';
import { Spinner } from '@/components/common/Spinner';

interface GroupTeamListProps {
    organizerId: string;
}

export const GroupTeamList = ({ organizerId }: GroupTeamListProps) => {
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const data = await api.groups.listMembers(organizerId);
                // Filter out global admins (platform superusers)
                // Assuming is_admin on member object reflects the user's global admin status
                // based on the backend GroupMemberResponse schema
                const filteredMembers = data.filter(m => !m.is_admin);
                setMembers(filteredMembers);
            } catch (err) {
                console.error('Failed to fetch members:', err);
                setError('Failed to load team members.');
            } finally {
                setIsLoading(false);
            }
        };

        if (organizerId) {
            fetchMembers();
        }
    }, [organizerId]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Spinner size="md" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-red-500">
                {error}
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500">No other team members found.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
                <div key={member.user_id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-4">
                    <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
                            {(member.user_username || member.user_email || '?').charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {member.user_username || 'Unknown User'}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                            ${member.role === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                                member.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                            {member.role}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};
