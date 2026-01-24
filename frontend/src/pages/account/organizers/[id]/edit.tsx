/**
 * Edit Organizer Profile Page
 * Features tabbed interface for Profile Details and Team Management
 */
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { AuthGuard } from '@/components/common/AuthGuard';
import { Spinner } from '@/components/common/Spinner';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import GroupForm, { GroupFormData } from '@/components/groups/GroupForm';
import { GroupMember, GroupInvite, GroupRole } from '@/types';
import { toast } from 'react-hot-toast';

// Role badge colors
const ROLE_COLORS: Record<GroupRole, { bg: string; text: string }> = {
    owner: { bg: 'bg-purple-100', text: 'text-purple-800' },
    admin: { bg: 'bg-blue-100', text: 'text-blue-800' },
    editor: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function EditOrganizerPage() {
    const router = useRouter();
    const { id } = router.query;
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<'profile' | 'team'>('profile');

    // Profile form data
    const [formData, setFormData] = useState<GroupFormData | undefined>(undefined);
    const [organizerSlug, setOrganizerSlug] = useState<string | null>(null);

    // Team management state
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [invites, setInvites] = useState<GroupInvite[]>([]);
    const [inviteEmail, setInviteEmail] = useState(''); // New state
    const [userRole, setUserRole] = useState<GroupRole | null>(null);
    const [organizerUserId, setOrganizerUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!id || authLoading) return;

        // Set initial tab from query
        if (router.query.tab === 'team') {
            setActiveTab('team');
        }

        if (!isAuthenticated) {
            router.push(`/auth/login?redirect=/account/organizers/${id}/edit`);
            return;
        }

        const fetchData = async () => {
            try {
                const org = await api.organizers.get(id as string);
                setFormData({
                    name: org.name || '',
                    bio: org.bio || '',
                    website_url: org.website_url || '',
                    logo_url: org.logo_url || '',
                    social_links: org.social_links || {},
                    cover_image_url: org.cover_image_url || '',
                    city: org.city || '',
                    social_facebook: org.social_facebook || '',
                    social_instagram: org.social_instagram || '',
                    social_website: org.social_website || '',
                    public_email: org.public_email || '',
                    social_linkedin: org.social_linkedin || '', // Added
                    contact_number: org.contact_number || '', // Added
                });
                setOrganizerUserId(org.user_id);
                setOrganizerSlug(org.slug || null);

                // Check user's role in this group
                try {
                    const membership = await api.groups.checkMembership(id as string);
                    setUserRole(membership.role as GroupRole);
                } catch (err) {
                    console.error('Failed to check membership:', err);
                }

                // Fetch members
                try {
                    const membersData = await api.groups.listMembers(id as string);
                    setMembers(membersData || []);
                } catch (err) {
                    console.error('Failed to fetch members:', err);
                }

                // Fetch pending invites (only if OWNER or ADMIN)
                try {
                    const invitesData = await api.groups.listInvites(id as string);
                    setInvites(invitesData || []);
                } catch (err) {
                    // May fail if user is EDITOR - that's OK

                }
            } catch (err) {
                setError('Failed to load organizer profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, isAuthenticated, authLoading, router]);

    const handleSubmit = async (data: GroupFormData) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const updateData = {
                name: data.name,
                bio: data.bio || undefined,
                website_url: data.website_url || undefined,
                logo_url: data.logo_url || undefined,
                social_links: Object.keys(data.social_links).length > 0 ? data.social_links : undefined,
                cover_image_url: data.cover_image_url || undefined,
                city: data.city || undefined,
                social_facebook: data.social_facebook || undefined,
                social_instagram: data.social_instagram || undefined,
                social_website: data.social_website || undefined,
                social_linkedin: data.social_linkedin || undefined,
                public_email: data.public_email || undefined,
                contact_number: data.contact_number || undefined,
            };

            const updatedOrg = await api.organizers.update(id as string, updateData);
            setSuccessMessage('Profile updated successfully!');

            // Redirect to the public group page after a short delay
            setTimeout(() => {
                // Use new slug if name changed (assuming API returns it), otherwise fallback or use old one
                const newSlug = (updatedOrg as any).slug || organizerSlug;
                router.push(`/groups/${newSlug}`);
            }, 1000);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update organizer profile');
        } finally {
            setIsSubmitting(false);
        }
    };



    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this organizer profile? This cannot be undone.')) {
            return;
        }

        try {
            await api.organizers.delete(id as string);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete organizer profile');
        }
    };

    // Team management handlers
    const handleGenerateInvite = async () => {
        try {
            const invite = await api.groups.createInvite(id as string, inviteEmail);

            if (inviteEmail) {
                setSuccessMessage(`Invitation sent to ${inviteEmail}`);
                setInviteEmail('');
            } else {
                const inviteUrl = `${window.location.origin}/join/group/${invite.token}`;
                navigator.clipboard.writeText(inviteUrl);
                alert(`Invite link copied to clipboard!\n\n${inviteUrl}\n\nThis link expires in 7 days.`);
            }

            // Refresh invites
            const invitesData = await api.groups.listInvites(id as string);
            setInvites(invitesData || []);
        } catch (err) {
            console.error('Failed to generate invite:', err);
            alert('Failed to send/generate invite');
        }
    };

    const handleCopyInviteLink = (token: string) => {
        const inviteUrl = `${window.location.origin}/join/group/${token}`;
        navigator.clipboard.writeText(inviteUrl);
        setSuccessMessage('Invite link copied!');
        setTimeout(() => setSuccessMessage(null), 2000);
    };

    const handleDeleteInvite = async (token: string) => {
        if (!confirm('Are you sure you want to revoke this invite link?')) return;
        try {
            await api.groups.deleteInvite(id as string, token);
            setInvites(prev => prev.filter(inv => inv.token !== token));
            setSuccessMessage('Invite revoked');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            setError('Failed to revoke invite');
        }
    };

    const handleRemoveMember = async (userId: string, userEmail?: string) => {
        if (!confirm(`Remove ${userEmail || 'this member'} from the team?`)) return;
        try {
            await api.groups.removeMember(id as string, userId);
            setMembers(prev => prev.filter(m => m.user_id !== userId));
            setSuccessMessage('Member removed');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to remove member');
        }
    };

    const handleRoleChange = async (userId: string, newRole: GroupRole) => {
        try {
            await api.groups.updateMemberRole(id as string, userId, newRole);
            setMembers(prev => prev.map(m =>
                m.user_id === userId ? { ...m, role: newRole } : m
            ));
            setSuccessMessage('Role updated');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to update role');
        }
    };

    const canManageTeam = userRole === 'owner' || userRole === 'admin';
    const isOwner = userRole === 'owner';

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href={`/groups/${organizerSlug || ''}`} className="text-sm text-gray-600 hover:text-emerald-600 mb-4 inline-block">
                        &larr; Back to Group
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Edit Organizer Profile</h1>
                </div>

                {/* Success/Error Messages */}
                {successMessage && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">{successMessage}</p>
                    </div>
                )}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'profile'
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Profile Details
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'team'
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Manage Team
                            <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                                {members.length}
                            </span>
                        </button>
                    </nav>
                </div>

                {/* Profile Tab */}
                {activeTab === 'profile' && formData && (
                    <GroupForm
                        initialData={formData}
                        onSubmit={handleSubmit}
                        isLoading={isSubmitting}
                        mode="edit"
                        onCancel={() => router.push('/account')}
                        onDelete={handleDelete}
                        isOwner={isOwner}
                    />
                )}

                {/* Team Tab */}
                {activeTab === 'team' && (
                    <div className="space-y-6">
                        {/* Team Members */}
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
                            <div className="space-y-3">
                                {(() => {
                                    // Ghost Mode: Filter out Global Admins from the list
                                    const visibleMembers = members.filter(member => !member.is_admin);

                                    return (
                                        <>
                                            {visibleMembers.map((member) => {
                                                const isCreator = member.user_id === organizerUserId;
                                                const isSelf = member.user_id === user?.id;
                                                const roleColors = ROLE_COLORS[member.role] || ROLE_COLORS.editor;

                                                return (
                                                    <div
                                                        key={member.user_id}
                                                        className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                                                    >
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold mr-3">
                                                                {(member.user_username || member.user_email || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">
                                                                    {member.user_username || member.user_email || 'Unknown'}
                                                                    {isSelf && <span className="text-gray-500 ml-1">(you)</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {/* Role Badge / Selector */}
                                                            {isOwner && !isCreator ? (
                                                                <select
                                                                    value={member.role}
                                                                    onChange={(e) => handleRoleChange(member.user_id, e.target.value as GroupRole)}
                                                                    className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                                                >
                                                                    <option value="admin">Admin</option>
                                                                    <option value="editor">Editor</option>
                                                                </select>
                                                            ) : (
                                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors.bg} ${roleColors.text}`}>
                                                                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                                                </span>
                                                            )}

                                                            {/* Remove Button */}
                                                            {canManageTeam && !isCreator && !isSelf && (
                                                                <button
                                                                    onClick={() => handleRemoveMember(member.user_id, member.user_email)}
                                                                    className="text-red-600 hover:text-red-800 p-1"
                                                                    title="Remove member"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {visibleMembers.length === 0 && (
                                                <p className="text-sm text-gray-500 text-center py-4">No additional team members assigned.</p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </Card>

                        {/* Invite Section - Only for OWNER/ADMIN */}
                        {canManageTeam && (
                            <Card>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite New Members</h3>
                                <div className="space-y-4">
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600 mb-2">
                                            Enter an email address to send an invitation, or leave blank to generate a link.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            placeholder="new.member@example.com (optional)"
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="max-w-md"
                                        />
                                        <Button variant="primary" onClick={handleGenerateInvite}>
                                            {inviteEmail ? 'Send Invite' : 'Generate Link'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Pending Invites */}
                                {invites.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-gray-200">
                                        <h4 className="text-sm font-medium text-gray-900 mb-3">Pending Invites</h4>
                                        <div className="space-y-2">
                                            {invites.map((invite) => {
                                                const expiresIn = Math.max(0, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                                return (
                                                    <div key={invite.token} className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg">
                                                        <div>
                                                            <p className="text-sm text-gray-700 font-mono">
                                                                ...{invite.token.slice(-8)}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleCopyInviteLink(invite.token)}
                                                                className="text-sm text-emerald-600 hover:text-emerald-800"
                                                            >
                                                                Copy Link
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteInvite(invite.token)}
                                                                className="text-sm text-red-600 hover:text-red-800"
                                                            >
                                                                Revoke
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Permissions Info for non-admins */}
                        {!canManageTeam && (
                            <Card>
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">
                                        You can view team members but need Admin or Owner permissions to invite or manage members.
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

