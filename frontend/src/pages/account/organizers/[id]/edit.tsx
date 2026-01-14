/**
 * Edit Organizer Profile Page
 * Features tabbed interface for Profile Details and Team Management
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import ImageUpload from '@/components/common/ImageUpload';
import { GroupMember, GroupInvite, GroupRole } from '@/types';

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
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        website_url: '',
        logo_url: '',
        social_links: {} as Record<string, string>,
        // New profile fields
        cover_image_url: '',
        city: '',
        social_facebook: '',
        social_instagram: '',
        social_website: '',
        public_email: '',
        slug: '',
    });

    const [newSocialPlatform, setNewSocialPlatform] = useState('');
    const [newSocialUrl, setNewSocialUrl] = useState('');

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
                    // New profile fields
                    cover_image_url: org.cover_image_url || '',
                    city: org.city || '',
                    social_facebook: org.social_facebook || '',
                    social_instagram: org.social_instagram || '',
                    social_website: org.social_website || '',
                    public_email: org.public_email || '',
                    slug: org.slug,
                });
                setOrganizerUserId(org.user_id);

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
                    console.log('Failed to fetch invites (may not have permission)');
                }
            } catch (err) {
                setError('Failed to load organizer profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id, isAuthenticated, authLoading, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddSocialLink = () => {
        if (newSocialPlatform && newSocialUrl) {
            setFormData(prev => ({
                ...prev,
                social_links: {
                    ...prev.social_links,
                    [newSocialPlatform.toLowerCase()]: newSocialUrl,
                },
            }));
            setNewSocialPlatform('');
            setNewSocialUrl('');
        }
    };

    const handleRemoveSocialLink = (platform: string) => {
        setFormData(prev => {
            const links = { ...prev.social_links };
            delete links[platform];
            return { ...prev, social_links: links };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const data = {
                name: formData.name,
                bio: formData.bio || undefined,
                website_url: formData.website_url || undefined,
                logo_url: formData.logo_url || undefined,
                social_links: Object.keys(formData.social_links).length > 0 ? formData.social_links : undefined,
                // New profile fields
                cover_image_url: formData.cover_image_url || undefined,
                city: formData.city || undefined,
                social_facebook: formData.social_facebook || undefined,
                social_instagram: formData.social_instagram || undefined,
                social_website: formData.social_website || undefined,
                public_email: formData.public_email || undefined,
            };

            await api.organizers.update(id as string, data);
            setSuccessMessage('Profile updated successfully!');

            // Redirect to public profile after short delay
            setTimeout(() => {
                if (formData.slug) {
                    router.push(`/groups/${formData.slug}`);
                } else {
                    // Fallback if slug isn't in state (shouldn't happen for existing orgs)
                    router.push('/account/profile');
                }
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
                    <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 mb-4 inline-block">
                        &larr; Back to Account
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
                {activeTab === 'profile' && (
                    <Card>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                    Organization Name *
                                </label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="e.g., Highland Music Society"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                                    Bio / Description
                                </label>
                                <textarea
                                    id="bio"
                                    name="bio"
                                    rows={4}
                                    value={formData.bio}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Tell people about your organization..."
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label htmlFor="website_url" className="block text-sm font-medium text-gray-700 mb-2">
                                    Website URL
                                </label>
                                <Input
                                    id="website_url"
                                    name="website_url"
                                    type="url"
                                    value={formData.website_url}
                                    onChange={handleChange}
                                    placeholder="https://example.com"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Logo
                                </label>
                                <div className="max-w-xs">
                                    <ImageUpload
                                        folder="organizers"
                                        currentImageUrl={formData.logo_url}
                                        onUpload={(urls) => setFormData(prev => ({ ...prev, logo_url: urls.url }))}
                                        onRemove={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                                        aspectRatio="1/1"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Recommended: Square image (1:1), at least 200x200px</p>
                                </div>
                            </div>


                            {/* Cover Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cover Image
                                </label>
                                <div className="w-full">
                                    <ImageUpload
                                        folder="organizers"
                                        currentImageUrl={formData.cover_image_url}
                                        onUpload={(urls) => setFormData(prev => ({ ...prev, cover_image_url: urls.url }))}
                                        onRemove={() => setFormData(prev => ({ ...prev, cover_image_url: '' }))}
                                        aspectRatio="3/1"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Recommended: Landscape image (3:1 aspect ratio), e.g., 1200x400px</p>
                                </div>
                            </div>

                            {/* City */}
                            <div>
                                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                                    City / Location
                                </label>
                                <Input
                                    id="city"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    placeholder="e.g., Inverness"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Social Media Links */}
                            <div className="pt-6 border-t border-gray-200">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Social & Contact</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="social_facebook" className="block text-sm font-medium text-gray-700 mb-2">
                                            Facebook URL
                                        </label>
                                        <Input
                                            id="social_facebook"
                                            name="social_facebook"
                                            type="url"
                                            value={formData.social_facebook}
                                            onChange={handleChange}
                                            placeholder="https://facebook.com/yourpage"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="social_instagram" className="block text-sm font-medium text-gray-700 mb-2">
                                            Instagram URL
                                        </label>
                                        <Input
                                            id="social_instagram"
                                            name="social_instagram"
                                            type="url"
                                            value={formData.social_instagram}
                                            onChange={handleChange}
                                            placeholder="https://instagram.com/yourhandle"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="social_website" className="block text-sm font-medium text-gray-700 mb-2">
                                            Website URL
                                        </label>
                                        <Input
                                            id="social_website"
                                            name="social_website"
                                            type="url"
                                            value={formData.social_website}
                                            onChange={handleChange}
                                            placeholder="https://yourwebsite.com"
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="public_email" className="block text-sm font-medium text-gray-700 mb-2">
                                            Public Contact Email
                                            <span className="text-gray-500 font-normal ml-1">(visible on your profile)</span>
                                        </label>
                                        <Input
                                            id="public_email"
                                            name="public_email"
                                            type="email"
                                            value={formData.public_email}
                                            onChange={handleChange}
                                            placeholder="contact@yourorganization.com"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Additional Social Links (legacy) */}
                            <div className="pt-6 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Other Social Links
                                </label>

                                {Object.entries(formData.social_links).length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {Object.entries(formData.social_links).map(([platform, url]) => (
                                            <div key={platform} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                                                <span className="text-sm">
                                                    <span className="font-medium capitalize">{platform}:</span> {url}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSocialLink(platform)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Platform (e.g., twitter)"
                                        value={newSocialPlatform}
                                        onChange={(e) => setNewSocialPlatform(e.target.value)}
                                        disabled={isSubmitting}
                                        className="flex-1"
                                    />
                                    <Input
                                        placeholder="URL"
                                        value={newSocialUrl}
                                        onChange={(e) => setNewSocialUrl(e.target.value)}
                                        disabled={isSubmitting}
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleAddSocialLink}
                                        disabled={isSubmitting || !newSocialPlatform || !newSocialUrl}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                {isOwner && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="text-sm text-red-600 hover:text-red-800"
                                    >
                                        Delete Profile
                                    </button>
                                )}
                                <div className="flex gap-3 ml-auto">
                                    <Link href="/account" className="text-sm text-gray-600 hover:text-emerald-600 py-2">
                                        Cancel
                                    </Link>
                                    <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Card>
                )}

                {/* Team Tab */}
                {activeTab === 'team' && (
                    <div className="space-y-6">
                        {/* Team Members */}
                        <Card>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
                            <div className="space-y-3">
                                {members.map((member) => {
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
                                                    {(member.user_display_name || member.user_email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {member.user_display_name || member.user_email || 'Unknown'}
                                                        {isSelf && <span className="text-gray-500 ml-1">(you)</span>}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{member.user_email}</p>
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
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {members.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-4">No team members yet.</p>
                                )}
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

