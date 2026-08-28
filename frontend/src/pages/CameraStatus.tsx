import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Camera, Wifi, WifiOff, Activity, Eye, EyeOff, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';
import { camerasService, parseRtspUrl, type Camera as CameraType } from '@/services/cameras';
import { violationsService } from '@/services/violations';
import { useToast } from '@/hooks/use-toast';

type CameraFormState = {
  name: string;
  location: string;
  camera_ip: string;
  rtsp_username: string;
  rtsp_password: string;
  stream_quality: string;
};

const EMPTY_CAMERA_FORM: CameraFormState = {
  name: '',
  location: '',
  camera_ip: '',
  rtsp_username: '',
  rtsp_password: '',
  stream_quality: 'stream1',
};

const CameraStatus = () => {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [violationCounts, setViolationCounts] = useState<Record<number, number>>({});
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null);
  const [cameraForm, setCameraForm] = useState<CameraFormState>(EMPTY_CAMERA_FORM);
  const [cameraFormError, setCameraFormError] = useState('');
  const [showRtspPassword, setShowRtspPassword] = useState(false);
  const [isSavingCamera, setIsSavingCamera] = useState(false);
  const [cameraToDelete, setCameraToDelete] = useState<CameraType | null>(null);
  const [isDeletingCamera, setIsDeletingCamera] = useState(false);
  const canAccessViolationData =
    hasPermission('can_view_violations') || hasPermission('can_view_reports');
  const canManageCameras = hasPermission('can_manage_cameras');


  useEffect(() => {
    loadCameras();
    const interval = setInterval(loadCameras, 5000);
    return () => clearInterval(interval);
  }, [canAccessViolationData]);


  const fetchViolationCounts = async (cameraList: CameraType[]) => {
    if (!canAccessViolationData) {
      setViolationCounts({});
      return;
    }

    const counts: Record<number, number> = {};
    const today = new Date().toISOString().split('T')[0];

    await Promise.all(
      cameraList.map(async (cam) => {
        try {
          const data = await violationsService.getViolations({ camera: cam.id, date: today });
          counts[cam.id] = data.count ?? (data.results?.length ?? 0);
        } catch {
          counts[cam.id] = 0;
        }
      })
    );
    setViolationCounts(counts);
  };


  const loadCameras = async () => {
    if (cameras.length > 0) setIsRefreshing(true);

    try {
      const data = await camerasService.getCameras();
      const rawList = Array.isArray(data)
        ? data
        : data && Array.isArray(data.results)
        ? data.results
        : [];
      const list = [...rawList].sort(
        (a: CameraType, b: CameraType) => a.id - b.id
      );
      setCameras(list);
      void fetchViolationCounts(list);
    } catch (error) {
      console.error("Failed to load cameras:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };


  const resetCameraForm = () => {
    setCameraForm(EMPTY_CAMERA_FORM);
    setCameraFormError('');
    setEditingCamera(null);
    setShowRtspPassword(false);
  };


  const handleManageDialogChange = (open: boolean) => {
    if (isSavingCamera) {
      return;
    }

    setIsManageDialogOpen(open);
    if (!open) {
      resetCameraForm();
    }
  };


  const openCreateDialog = () => {
    resetCameraForm();
    setIsManageDialogOpen(true);
  };


  const openEditDialog = (camera: CameraType) => {
    setEditingCamera(camera);
    const parsed = parseRtspUrl(camera.rtsp_url || '');
    setCameraForm({
      name: camera.name || '',
      location: camera.location || '',
      camera_ip: parsed?.camera_ip || '',
      rtsp_username: parsed?.rtsp_username || '',
      rtsp_password: parsed?.rtsp_password || '',
      stream_quality: parsed?.stream_quality || 'stream1',
    });
    setCameraFormError('');
    setShowRtspPassword(false);
    setIsManageDialogOpen(true);
  };


  const handleCameraSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: Record<string, string | undefined> = {
      name: cameraForm.name.trim(),
      location: cameraForm.location.trim(),
    };

    if (editingCamera) {
      payload.camera_ip = cameraForm.camera_ip.trim() || undefined;
      payload.rtsp_username = cameraForm.rtsp_username.trim() || undefined;
      payload.rtsp_password = cameraForm.rtsp_password || undefined;
      payload.stream_quality = cameraForm.stream_quality || undefined;
    } else {
      payload.camera_ip = cameraForm.camera_ip.trim();
      payload.rtsp_username = cameraForm.rtsp_username.trim();
      payload.rtsp_password = cameraForm.rtsp_password;
      payload.stream_quality = cameraForm.stream_quality;
    }

    if (!payload.name) {
      setCameraFormError('Camera name is required.');
      return;
    }

    if (!editingCamera && !payload.camera_ip) {
      setCameraFormError('Camera IP address is required.');
      return;
    }

    setIsSavingCamera(true);
    setCameraFormError('');

    try {
      const savedCamera = editingCamera
        ? await camerasService.updateCamera(editingCamera.id, payload)
        : await camerasService.createCamera(payload as any);

      if (selectedCamera?.id === savedCamera.id) {
        setSelectedCamera(savedCamera);
      }

      toast({
        title: editingCamera ? 'Camera Updated' : 'Camera Added',
        description: editingCamera
          ? `${payload.name} was updated successfully.`
          : `${payload.name} was added successfully.`,
      });

      handleManageDialogChange(false);
      await loadCameras();
    } catch {
      setCameraFormError(
        editingCamera
          ? 'Could not update this camera. Please check the fields and try again.'
          : 'Could not add this camera. Please check the fields and try again.'
      );
      toast({
        title: editingCamera ? 'Update Failed' : 'Add Failed',
        description: editingCamera
          ? 'The camera could not be updated.'
          : 'The camera could not be created.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCamera(false);
    }
  };


  const handleDeleteCamera = async () => {
    if (!cameraToDelete) {
      return;
    }

    setIsDeletingCamera(true);
    try {
      await camerasService.deleteCamera(cameraToDelete.id);

      if (selectedCamera?.id === cameraToDelete.id) {
        setSelectedCamera(null);
        setIsModalOpen(false);
      }

      if (editingCamera?.id === cameraToDelete.id) {
        handleManageDialogChange(false);
      }

      toast({
        title: 'Camera Deleted',
        description: `${cameraToDelete.name} was removed successfully.`,
      });

      setCameraToDelete(null);
      await loadCameras();
    } catch {
      toast({
        title: 'Delete Failed',
        description: 'The camera could not be removed.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingCamera(false);
    }
  };


  const handleCameraClick = async (camera: CameraType) => {
    try {
      const latest = await camerasService.getCamera(camera.id);

      if (latest.status !== 'active') {
        toast({
          title: "Camera Offline",
          description: "This camera is currently offline and cannot be viewed.",
          variant: "destructive"
        });
        return;
      }

      if (!latest.stream_url) {
        toast({
          title: "No Stream Available",
          description: "This camera does not have a stream URL configured.",
          variant: "destructive"
        });
        return;
      }

      setSelectedCamera(latest);
      setIsModalOpen(true);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load latest camera data.",
        variant: "destructive"
      });
    }
  };


  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/50 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          Online
        </Badge>
      );
    }
    return <Badge variant="secondary">Offline</Badge>;
  };


  const getStatusIcon = (status: string) => {
    if (status === 'active') return <Wifi className="w-5 h-5 text-primary" />;
    return <WifiOff className="w-5 h-5 text-muted-foreground" />;
  };


  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return 'Never';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };


  const formatUptime = (lastSeen: string | null) => {
    if (!lastSeen) return 'N/A';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours < 24 ? '99.8%' : '95.0%';
  };


  const getStreamUrl = (camera: CameraType) => {
    // YOLO now stores the MJPEG URL (http://127.0.0.1:8081/stream)
    // directly in camera.stream_url — use it directly, no auth needed
    return camera.stream_url || '';
  };


  const totalCameras  = cameras.length;
  const onlineCameras = cameras.filter(c => c.status === 'active').length;
  const offlineCameras = totalCameras - onlineCameras;
  const avgUptime     = cameras.length > 0 ? '98.2%' : '0%';


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading cameras...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="app-page-heading">Manage Cameras</h2>
          <p className="app-body-text text-muted-foreground">
            Monitor camera status, view live feeds, and manage detection devices.
          </p>
          {canManageCameras && (
            <p className="app-hint-text mt-2">
              Users with camera management access can add, edit, and remove camera devices from this page.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManageCameras && (
            <Button type="button" className="h-11 rounded-xl px-4 text-sm font-semibold" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Add Camera
            </Button>
          )}
          {isRefreshing && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Updating...
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="app-label-text">Total Cameras</p>
                <h3 className="mt-2 text-[18px] font-medium text-foreground">{totalCameras}</h3>
              </div>
              <Camera className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="app-label-text">Online</p>
                <h3 className="mt-2 text-[18px] font-medium text-foreground">{onlineCameras}</h3>
                {offlineCameras > 0 && (
                  <p className="app-hint-text mt-1">{offlineCameras} offline</p>
                )}
              </div>
              <Wifi className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="app-label-text">Avg. Uptime</p>
                <h3 className="mt-2 text-[18px] font-medium text-foreground">{avgUptime}</h3>
              </div>
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Camera Grid */}
      {cameras.length === 0 ? (
        <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="app-hint-text">No cameras configured yet</p>
              {canManageCameras && (
                <Button type="button" variant="outline" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Add First Camera
                </Button>
              )}
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <Card
              key={camera.id}
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => handleCameraClick(camera)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      camera.status === 'active' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Camera className={`w-6 h-6 ${
                        camera.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-[13px] font-medium text-foreground">{camera.name}</CardTitle>
                      <p className="app-hint-text mt-1">
                        CAM-{String(camera.id).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManageCameras && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditDialog(camera);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCameraToDelete(camera);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {getStatusIcon(camera.status)}
                    {camera.status === 'active' && (
                      <Eye className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">Location:</span>
                  <span className="font-medium text-foreground text-right">
                    {camera.location || 'Not specified'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">Status:</span>
                  {getStatusBadge(camera.status)}
                </div>
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">Last Seen:</span>
                  <span className={`font-medium text-right ${
                    camera.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {formatLastSeen(camera.last_seen_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">Uptime:</span>
                  <span className="font-medium text-foreground">
                    {formatUptime(camera.last_seen_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">FPS:</span>
                  <span className="font-medium text-foreground">
                    {camera.status === 'active' ? '15' : '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] gap-3">
                  <span className="app-label-text">Detections Today:</span>
                  <span className="font-medium text-foreground">
                    {violationCounts[camera.id] ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isManageDialogOpen} onOpenChange={handleManageDialogChange}>
        <DialogContent className="max-w-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>{editingCamera ? 'Edit Camera' : 'Add Camera'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCameraSubmit}>
            <div className="space-y-2">
              <label className="app-label-text" htmlFor="camera-name">Camera Name</label>
              <Input
                id="camera-name"
                value={cameraForm.name}
                onChange={(event) => setCameraForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. CCTV - 2"
                disabled={isSavingCamera}
              />
            </div>
            <div className="space-y-2">
              <label className="app-label-text" htmlFor="camera-location">Location</label>
              <Input
                id="camera-location"
                value={cameraForm.location}
                onChange={(event) => setCameraForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="e.g. BNHS"
                disabled={isSavingCamera}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="app-label-text" htmlFor="camera-ip">Camera IP</label>
                <Input
                  id="camera-ip"
                  value={cameraForm.camera_ip}
                  onChange={(event) => setCameraForm((current) => ({ ...current, camera_ip: event.target.value }))}
                  placeholder="e.g. 192.168.1.100"
                  disabled={isSavingCamera}
                />
              </div>
              <div className="space-y-2">
                <label className="app-label-text" htmlFor="stream-quality">Stream Quality</label>
                <select
                  id="stream-quality"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={cameraForm.stream_quality}
                  onChange={(event) => setCameraForm((current) => ({ ...current, stream_quality: event.target.value }))}
                  disabled={isSavingCamera}
                >
                  <option value="stream1">Wide HQ</option>
                  <option value="stream2">Wide LQ</option>
                  <option value="stream6">Tele HQ</option>
                  <option value="stream7">Tele LQ</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="app-label-text" htmlFor="rtsp-username">RTSP Username</label>
                <Input
                  id="rtsp-username"
                  value={cameraForm.rtsp_username}
                  onChange={(event) => setCameraForm((current) => ({ ...current, rtsp_username: event.target.value }))}
                  placeholder="e.g. admin"
                  disabled={isSavingCamera}
                />
              </div>
              <div className="space-y-2">
                <label className="app-label-text" htmlFor="rtsp-password">RTSP Password</label>
                <div className="relative">
                  <Input
                    id="rtsp-password"
                    type={showRtspPassword ? 'text' : 'password'}
                    value={cameraForm.rtsp_password}
                    onChange={(event) => setCameraForm((current) => ({ ...current, rtsp_password: event.target.value }))}
                    placeholder={editingCamera ? 'Leave blank to keep current' : 'e.g. password123'}
                    disabled={isSavingCamera}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRtspPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showRtspPassword ? 'Hide password' : 'Show password'}
                    disabled={isSavingCamera}
                  >
                    {showRtspPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            {cameraFormError && (
              <p className="text-[12px] text-destructive">{cameraFormError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleManageDialogChange(false)} disabled={isSavingCamera}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCamera}>
                {isSavingCamera ? 'Saving...' : editingCamera ? 'Save Changes' : 'Add Camera'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(cameraToDelete)} onOpenChange={(open) => !open && !isDeletingCamera && setCameraToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Camera</AlertDialogTitle>
            <AlertDialogDescription>
              {cameraToDelete
                ? `Remove ${cameraToDelete.name} from the system? This permanently deletes the camera record and can also remove violations linked to that camera.`
                : 'Remove this camera from the system?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCamera}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCamera}
              disabled={isDeletingCamera}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCamera ? 'Deleting...' : 'Delete Camera'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Live View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {selectedCamera?.name} - Live View
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {selectedCamera?.stream_url ? (
                <img
                  src={getStreamUrl(selectedCamera)}
                  alt="Live Camera Stream"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    toast({
                      title: "Stream Error",
                      description: "Failed to load camera stream.",
                      variant: "destructive"
                    });
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="app-hint-text">No stream URL configured</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="app-label-text">Location</p>
                <p className="app-body-text">{selectedCamera?.location || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="app-label-text">Status</p>
                <div>{selectedCamera && getStatusBadge(selectedCamera.status)}</div>
              </div>
              <div className="space-y-1">
                <p className="app-label-text">Camera ID</p>
                <p className="app-body-text">
                  CAM-{String(selectedCamera?.id).padStart(3, '0')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="app-label-text">Last Seen</p>
                <p className="app-body-text">
                  {selectedCamera && formatLastSeen(selectedCamera.last_seen_at)}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};


export default CameraStatus;
