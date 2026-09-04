import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { folderCache } from '../lib/cache';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Breadcrumbs from '../components/Breadcrumbs';
import QuickAccess from '../components/QuickAccess';
import FileList from '../components/FileList';
import NewFolderModal from '../components/NewFolderModal';
import UploadModal from '../components/UploadModal';
import FilePreviewModal from '../components/FilePreviewModal';
import ShareModal from '../components/ShareModal';
import { FolderPlus, UploadCloud, X } from 'lucide-react';
import VersionModal from '../components/VersionModal';

export default function Dashboard() {
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', name: 'My Files' }]);
  const [loading, setLoading] = useState(true);
  const [versionFile, setVersionFile] = useState(null);

  // Search & Filter State
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Modal States
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [resourceToShare, setResourceToShare] = useState(null);

  const fetchFolderContent = async (folderId, skipCache = false) => {
    setLoading(true);
    setActiveSearchQuery('');
    setSearchResults(null);

    const cacheKey = `folder:${folderId}`;
    if (!skipCache) {
      const cached = folderCache.get(cacheKey);
      if (cached) {
        setFolders(cached.folders);
        setFiles(cached.files);
        setBreadcrumbs(cached.breadcrumbs);
        setCurrentFolderId(folderId);
        setLoading(false);
        return;
      }
    }

    try {
      const { data } = await api.get(`/folders/${folderId}`);
      const folderList = data.children?.folders || [];
      const fileList = data.children?.files || [];
      const crumbs = data.breadcrumbs || [{ id: 'root', name: 'My Files' }];

      folderCache.set(cacheKey, { folders: folderList, files: fileList, breadcrumbs: crumbs });

      setFolders(folderList);
      setFiles(fileList);
      setBreadcrumbs(crumbs);
      setCurrentFolderId(folderId);
    } catch (err) {
      console.error('Failed to load folder data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolderContent(currentFolderId);
  }, []);

  // Full-page search handler
  const handleSearchSubmit = async (queryText) => {
    if (!queryText.trim()) {
      setActiveSearchQuery('');
      setSearchResults(null);
      return;
    }

    setLoading(true);
    setActiveSearchQuery(queryText);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(queryText)}&limit=50`);
      const items = data.results || [];
      setSearchResults({
        folders: items.filter((i) => i.resource_type === 'folder' || (!i.mime_type && !i.storage_key)),
        files: items.filter((i) => i.resource_type === 'file' || i.mime_type || i.storage_key),
      });
    } catch (err) {
      console.error('Search query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchResult = (item) => {
    if (item.resource_type === 'folder' || (!item.mime_type && !item.storage_key)) {
      fetchFolderContent(item.id);
    } else {
      setPreviewFile(item);
    }
  };

  // Sorting Handler
  const handleSortChange = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Multi-column sorting calculation
  const sortedData = useMemo(() => {
    const rawFolders = searchResults ? searchResults.folders : folders;
    const rawFiles = searchResults ? searchResults.files : files;

    const sorter = (a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'name') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      } else if (sortConfig.key === 'updated_at') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else if (sortConfig.key === 'size_bytes') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    };

    return {
      folders: [...rawFolders].sort(sorter),
      files: [...rawFiles].sort(sorter),
    };
  }, [folders, files, searchResults, sortConfig]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar onNewFolderClick={() => setIsNewFolderOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onSelectSearchResult={handleSelectSearchResult}
          onSearchSubmit={handleSearchSubmit}
        />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {activeSearchQuery ? `Search Results for "${activeSearchQuery}"` : 'My Files'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeSearchQuery
                  ? `Showing matching files and folders`
                  : 'Manage and organize your cloud files.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {activeSearchQuery ? (
                <button
                  onClick={() => {
                    setActiveSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl text-sm transition flex items-center gap-1.5"
                >
                  <X className="h-4 w-4" /> Clear Search
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-slate-700 font-medium rounded-xl text-sm shadow-sm transition flex items-center gap-2"
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>Upload files</span>
                  </button>
                  <button
                    onClick={() => setIsNewFolderOpen(true)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-sm transition flex items-center gap-2 shadow-xs"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>New folder</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {!activeSearchQuery && (
            <>
              <Breadcrumbs breadcrumbs={breadcrumbs} onNavigate={fetchFolderContent} />
              {currentFolderId === 'root' && <QuickAccess />}
            </>
          )}

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">Loading contents...</div>
          ) : (
            <FileList
              folders={sortedData.folders}
              files={sortedData.files}
              onFolderClick={fetchFolderContent}
              onFilePreview={(file) => setPreviewFile(file)}
              onShare={(res) => setResourceToShare(res)}
              sortConfig={sortConfig}
              onSortChange={handleSortChange}
              onVersionClick={(file) => setVersionFile(file)}
            />
          )}
        </main>
      </div>

      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreate={async (name) => {
          await api.post('/folders', {
            name,
            parentId: currentFolderId === 'root' ? null : currentFolderId,
          });
          folderCache.invalidate(`folder:${currentFolderId}`);
          fetchFolderContent(currentFolderId, true);
        }}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentFolderId={currentFolderId}
        onUploadSuccess={() => {
          folderCache.invalidate(`folder:${currentFolderId}`);
          fetchFolderContent(currentFolderId, true);
        }}
      />

      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      <ShareModal
        isOpen={!!resourceToShare}
        onClose={() => setResourceToShare(null)}
        resource={resourceToShare}
      />

      <VersionModal
        file={versionFile}
        isOpen={!!versionFile}
        onClose={() => setVersionFile(null)}
        onVersionReverted={() => fetchFolderContent(currentFolderId)}
      />
    </div>
  );
}