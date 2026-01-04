import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'documents';

/**
 * Uploads a file to the secure documents bucket.
 * Returns the storage path if successful, or throws an error.
 */
export const uploadDocument = async (
    file: File,
    path: string
): Promise<{ path: string; error: Error | null }> => {

    // 1. Upload file
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, {
            upsert: true,
            contentType: file.type
        });

    if (error) {
        console.error('Storage upload error:', error);
        return { path: '', error };
    }

    return { path: data.path, error: null };
};

/**
 * Generates a signed URL for viewing a private document.
 * Valid for 1 hour.
 */
export const getDocumentUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(path, 3600); // 1 hour

    if (error) {
        console.error('Error signing URL:', error);
        return null;
    }

    return data.signedUrl;
};

/**
 * Deletes a file from storage.
 */
export const deleteDocument = async (path: string): Promise<boolean> => {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

    if (error) {
        console.error('Error deleting file:', error);
        return false;
    }

    return true;
};
