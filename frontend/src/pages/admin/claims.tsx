export async function getServerSideProps() {
    return {
        redirect: {
            destination: '/admin/moderation?tab=claims',
            permanent: true,
        },
    };
}

export default function ClaimsRedirect() {
    return null;
}
