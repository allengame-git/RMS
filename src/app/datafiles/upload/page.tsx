import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import UploadDataFileForm from '@/components/datafile/UploadDataFileForm';

export default async function UploadPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/auth/signin');

    if (session.user.role === 'VIEWER') {
        redirect('/datafiles');
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{
                fontSize: '1.8rem',
                fontWeight: 700,
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                📤 上傳新檔案
            </h1>

            <UploadDataFileForm />
        </div>
    );
}
