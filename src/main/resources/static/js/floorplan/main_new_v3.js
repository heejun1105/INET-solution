/**
 * main_new_v3.js
 * 평면도 시스템 메인 진입점 (리빌딩 버전)
 * 
 * 전체 애플리케이션 통합 및 모드 관리
 */

import FloorPlanCore from './core/FloorPlanCore.js';
import ElementManager from './core/ElementManager.js';
import InteractionManager from './core/InteractionManager.js';
import DataSyncManager from './core/DataSyncManager.js';
import UIManager from './core/UIManager.js';

import ClassroomDesignMode from './modes/ClassroomDesignMode.js';
import WirelessApDesignMode from './modes/WirelessApDesignMode.js';
import SeatLayoutMode from './modes/SeatLayoutMode.js';
import EquipmentViewMode from './modes/EquipmentViewMode.js';
import WirelessApViewMode from './modes/WirelessApViewMode.js';

/**
 * 평면도 애플리케이션
 */
class FloorPlanApp {
    constructor() {
        this.core = null;
        this.elementManager = null;
        this.interactionManager = null;
        this.dataSyncManager = null;
        this.uiManager = null;
        
        this.currentSchoolId = null;
        this.currentMode = null; // 'design-classroom', 'design-wireless', 'design-seat', 'view-equipment', 'view-wireless'
        this.modeManager = null;
        
        this.schools = [];
        
        console.log('🚀 FloorPlanApp 초기화');
    }
    
    /**
     * 초기화
     */
    async init() {
        try {
            // 워크스페이스 컨테이너 확인 (초기에는 숨김)
            const workspaceCanvasWrapper = document.getElementById('workspace-canvas-wrapper');
            if (!workspaceCanvasWrapper) {
                console.error('Workspace canvas wrapper not found');
                // 폴백: 기존 canvas 사용
                const container = document.getElementById('canvas');
                if (container) {
                    this.initCore(container);
                }
            } else {
                // 워크스페이스용 컨테이너에 초기화 (아직 표시 안함)
                this.initCore(workspaceCanvasWrapper);
            }
            
            // UI 설정
            this.setupUI();
            
            // 학교 목록 로드
            await this.loadSchools();
            
            console.log('✅ FloorPlanApp 초기화 완료');
        } catch (error) {
            console.error('초기화 오류:', error);
            alert('평면도 시스템 초기화 중 오류가 발생했습니다.');
        }
    }
    
    /**
     * 코어 초기화
     */
    initCore(container) {
        // 코어 모듈 초기화
        this.core = new FloorPlanCore(container, {
            canvasWidth: 24000, // 기본 교실 크기 120px * 200배
            canvasHeight: 16000,
            zoom: 0.5
        });
        
        this.elementManager = new ElementManager(this.core);
        this.dataSyncManager = new DataSyncManager(this.core, this.elementManager);
        this.uiManager = new UIManager(this.core, this.dataSyncManager, this.elementManager);
        this.interactionManager = new InteractionManager(this.core, this.elementManager);
        
        // Core에 schoolId 저장
        this.core.currentSchoolId = null;
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        // 설계 모드 버튼 (초기 화면)
        const designModeBtn = document.getElementById('designModeBtn');
        if (designModeBtn) {
            designModeBtn.addEventListener('click', () => this.openWorkspace('design'));
        }
        
        // 보기 모드 버튼 (초기 화면)
        const viewModeBtn = document.getElementById('viewModeBtn');
        if (viewModeBtn) {
            viewModeBtn.addEventListener('click', () => this.openWorkspace('view'));
        }
        
        // 워크스페이스 모달 내 컨트롤
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        const workspaceSaveBtn = document.getElementById('workspace-save-btn');
        const workspacePptBtn = document.getElementById('workspace-ppt-btn');
        const workspaceCloseBtn = document.getElementById('workspace-close-btn');
        
        if (workspaceSchoolSelect) {
            workspaceSchoolSelect.addEventListener('change', (e) => this.onWorkspaceSchoolChange(e.target.value));
        }
        
        if (workspaceModeSelect) {
            workspaceModeSelect.addEventListener('change', (e) => this.onWorkspaceModeChange(e.target.value));
        }
        
        if (workspaceSaveBtn) {
            workspaceSaveBtn.addEventListener('click', () => this.saveCurrentWork());
        }
        
        if (workspacePptBtn) {
            workspacePptBtn.addEventListener('click', () => this.downloadPPT());
        }
        
        if (workspaceCloseBtn) {
            workspaceCloseBtn.addEventListener('click', () => this.closeWorkspace());
        }
        
        // 배율 조정 버튼
        this.setupZoomControls();
        
        // 저장 버튼
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }
        
        // PPT 다운로드 버튼
        const pptBtn = document.getElementById('ppt-download-btn');
        if (pptBtn) {
            pptBtn.addEventListener('click', () => this.downloadPPT());
        }
    }
    
    /**
     * 배율 조정 컨트롤 설정
     */
    setupZoomControls() {
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        const zoomDisplay = document.getElementById('zoom-display');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.core.zoomIn();
                this.updateZoomDisplay();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.core.zoomOut();
                this.updateZoomDisplay();
            });
        }
        
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                this.core.resetZoom();
                this.updateZoomDisplay();
            });
        }
    }
    
    /**
     * 배율 표시 업데이트
     */
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoom-display');
        if (zoomDisplay && this.core) {
            const zoomPercent = Math.round(this.core.state.zoom * 100);
            zoomDisplay.textContent = `${zoomPercent}%`;
        }
    }
    
    /**
     * 학교 목록 로드
     */
    async loadSchools() {
        try {
            // Thymeleaf에서 주입된 schools 변수 사용
            if (typeof schools !== 'undefined') {
                this.schools = schools;
            } else {
                this.schools = [];
            }
            
            console.log('학교 목록 로드:', this.schools.length);
        } catch (error) {
            console.error('학교 목록 로드 오류:', error);
        }
    }
    
    /**
     * 학교 선택 모달 표시
     */
    showSchoolSelectModal() {
        const modal = document.getElementById('schoolSelectModal');
        const schoolList = document.getElementById('schoolList');
        
        if (!modal || !schoolList) return;
        
        // 학교 목록 렌더링
        schoolList.innerHTML = this.schools.map(school => `
            <div class="school-item" data-school-id="${school.schoolId}">
                <strong>${school.schoolName}</strong>
                <small>${school.address || ''}</small>
            </div>
        `).join('');
        
        // 학교 선택 이벤트
        schoolList.querySelectorAll('.school-item').forEach(item => {
            item.addEventListener('click', () => {
                schoolList.querySelectorAll('.school-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
        
        // 확인 버튼
        const confirmBtn = document.getElementById('confirmSchoolSelect');
        const cancelBtn = document.getElementById('cancelSchoolSelect');
        
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const selectedItem = schoolList.querySelector('.school-item.selected');
                if (selectedItem) {
                    const schoolId = parseInt(selectedItem.dataset.schoolId);
                    this.selectSchool(schoolId);
                    modal.classList.remove('active');
                } else {
                    alert('학교를 선택하세요');
                }
            };
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.classList.remove('active');
            };
        }
        
        modal.classList.add('active');
    }
    
    /**
     * 학교 선택
     */
    async selectSchool(schoolId) {
        this.currentSchoolId = schoolId;
        this.core.currentSchoolId = schoolId;
        
        const school = this.schools.find(s => s.schoolId === schoolId);
        const schoolName = school ? school.schoolName : `학교 ID: ${schoolId}`;
        
        console.log('✅ 학교 선택:', schoolName);
        this.uiManager.showNotification(`${schoolName} 선택됨`, 'success');
        
        // 평면도 로드
        await this.loadFloorPlan(schoolId);
        
        // 버튼 텍스트 업데이트
        const schoolSelectBtn = document.getElementById('school-select-btn');
        if (schoolSelectBtn) {
            schoolSelectBtn.querySelector('span').textContent = schoolName;
        }
    }
    
    /**
     * 평면도 로드
     */
    async loadFloorPlan(schoolId) {
        try {
            const result = await this.dataSyncManager.load(schoolId);
            
            if (result.success) {
                console.log('✅ 평면도 로드 완료');
                
                // 모든 요소가 보이도록 자동 피팅
                this.core.fitToElements();
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
            } else {
                console.log('ℹ️ 저장된 평면도 없음');
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
            }
        } catch (error) {
            console.error('평면도 로드 오류:', error);
        }
    }
    
    /**
     * 설계 모드 메뉴 표시
     */
    showDesignModeMenu() {
        const modes = [
            { id: 'design-classroom', name: '교실 설계', icon: 'fa-door-open' },
            { id: 'design-wireless', name: '무선AP 설계', icon: 'fa-wifi' },
            { id: 'design-seat', name: '자리배치 설계', icon: 'fa-chair' }
        ];
        
        this.showModeSelectionMenu('설계 모드 선택', modes);
    }
    
    /**
     * 보기 모드 메뉴 표시
     */
    showViewModeMenu() {
        const modes = [
            { id: 'view-equipment', name: '장비 모드', icon: 'fa-desktop' },
            { id: 'view-wireless', name: '무선AP 모드', icon: 'fa-wifi' }
        ];
        
        this.showModeSelectionMenu('보기 모드 선택', modes);
    }
    
    /**
     * 모드 선택 메뉴 표시
     */
    showModeSelectionMenu(title, modes) {
        if (!this.currentSchoolId) {
            alert('먼저 학교를 선택하세요');
            return;
        }
        
        const menu = prompt(`${title}\n\n` + modes.map((m, i) => `${i + 1}. ${m.name}`).join('\n'));
        const index = parseInt(menu) - 1;
        
        if (index >= 0 && index < modes.length) {
            this.switchMode(modes[index].id);
        }
    }
    
    /**
     * 모드 전환
     */
    async switchMode(mode) {
        console.log(`🔄 모드 전환: ${mode}`);
        
        // 기존 모드 비활성화
        if (this.modeManager && this.currentMode) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        this.currentMode = mode;
        
        // 새 모드 활성화
        switch (mode) {
            case 'design-classroom':
                this.modeManager = new ClassroomDesignMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'design-wireless':
                this.modeManager = new WirelessApDesignMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'design-seat':
                this.modeManager = new SeatLayoutMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'view-equipment':
                this.modeManager = new EquipmentViewMode(this.core, this.elementManager, this.uiManager);
                break;
            case 'view-wireless':
                this.modeManager = new WirelessApViewMode(this.core, this.elementManager, this.uiManager);
                break;
            default:
                console.error('알 수 없는 모드:', mode);
                return;
        }
        
        // 모드 활성화
        if (this.modeManager) {
            await this.modeManager.activate();
        }
        
        this.uiManager.showNotification(`${mode} 활성화`, 'success');
    }
    
    /**
     * 저장
     */
    async save() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        try {
            const result = await this.dataSyncManager.save(this.currentSchoolId);
            
            if (result.success) {
                this.uiManager.showNotification('저장 완료', 'success');
            } else {
                this.uiManager.showNotification('저장 실패: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 중 오류 발생', 'error');
        }
    }
    
    /**
     * PPT 다운로드
     */
    async downloadPPT() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        if (!this.currentMode || !this.currentMode.startsWith('view-')) {
            alert('보기 모드에서만 PPT 다운로드가 가능합니다');
            return;
        }
        
        try {
            const mode = this.currentMode === 'view-equipment' ? 'equipment' : 'wireless-ap';
            window.location.href = `/floorplan/export/ppt/${this.currentSchoolId}?mode=${mode}`;
            
            this.uiManager.showNotification('PPT 다운로드 시작', 'success');
        } catch (error) {
            console.error('PPT 다운로드 오류:', error);
            this.uiManager.showNotification('다운로드 실패', 'error');
        }
    }
    
    // ===== 워크스페이스 관리 =====
    
    /**
     * 워크스페이스 열기
     */
    openWorkspace(type) {
        console.log('🖼️ 워크스페이스 열기:', type);
        
        const workspaceModal = document.getElementById('workspace-modal');
        if (!workspaceModal) {
            console.error('Workspace modal not found');
            return;
        }
        
        // 워크스페이스 표시
        workspaceModal.style.display = 'block';
        
        // 캔버스가 표시된 후 리사이즈 및 중앙 뷰 설정
        setTimeout(() => {
            if (this.core) {
                this.core.resize();
                this.core.centerView(); // 중앙 뷰로 시작 (100% 배율)
                this.core.markDirty();
                this.updateZoomDisplay(); // 줌 디스플레이 업데이트
                console.log('🖼️ 캔버스 중앙 뷰 설정 및 강제 렌더링');
            }
        }, 100);
        
        // 모드 선택 드롭다운 필터링
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        if (workspaceModeSelect && type) {
            // 설계 모드면 설계 관련 옵션만, 보기 모드면 보기 관련 옵션만 보이도록
            Array.from(workspaceModeSelect.options).forEach(option => {
                const optgroup = option.parentElement;
                if (optgroup && optgroup.tagName === 'OPTGROUP') {
                    const isDesignGroup = optgroup.label.includes('설계');
                    if (type === 'design' && !isDesignGroup) {
                        option.style.display = 'none';
                    } else if (type === 'view' && isDesignGroup) {
                        option.style.display = 'none';
                    } else {
                        option.style.display = '';
                    }
                }
            });
        }
        
        // 학교 목록 로드
        this.populateWorkspaceSchoolDropdown();
        
        // 초기 줌 디스플레이 업데이트
        this.updateZoomDisplay();
        
        this.uiManager.showNotification('작업 공간 열림', `${type === 'design' ? '설계' : '보기'} 모드로 작업 공간이 열렸습니다.`, 'info');
    }
    
    /**
     * 워크스페이스 닫기
     */
    closeWorkspace() {
        console.log('🚪 워크스페이스 닫기');
        
        const workspaceModal = document.getElementById('workspace-modal');
        if (workspaceModal) {
            workspaceModal.style.display = 'none';
        }
        
        // 현재 모드 정리
        if (this.modeManager && this.modeManager.deactivate) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        // 도구창 숨김
        const toolbarContainer = document.getElementById('design-toolbar-container');
        if (toolbarContainer) {
            toolbarContainer.style.display = 'none';
        }
        
        // 상태 초기화
        this.currentMode = null;
        this.currentSchoolId = null;
        
        // Core 상태 초기화
        if (this.core) {
            this.core.currentSchoolId = null;
        }
        
        // 캔버스 요소 전체 삭제
        if (this.elementManager) {
            this.elementManager.clearAllElements();
        }
        
        // 캔버스 뷰 초기화
        if (this.core) {
            this.core.centerView();
            this.core.markDirty();
        }
        
        // 드롭다운 초기화
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        if (workspaceSchoolSelect) {
            workspaceSchoolSelect.value = '';
        }
        
        const workspaceModeSelect = document.getElementById('workspace-mode-select');
        if (workspaceModeSelect) {
            workspaceModeSelect.value = '';
        }
        
        this.uiManager.showNotification('작업 공간 닫힘', '변경 사항이 저장되지 않았을 수 있습니다.', 'warning');
    }
    
    /**
     * 워크스페이스 학교 드롭다운 채우기
     */
    populateWorkspaceSchoolDropdown() {
        const workspaceSchoolSelect = document.getElementById('workspace-school-select');
        if (!workspaceSchoolSelect) return;
        
        // 기존 옵션 제거 (첫 번째 제외)
        while (workspaceSchoolSelect.options.length > 1) {
            workspaceSchoolSelect.remove(1);
        }
        
        // 학교 목록 추가
        this.schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.schoolId;
            option.textContent = school.schoolName;
            workspaceSchoolSelect.appendChild(option);
        });
    }
    
    /**
     * 워크스페이스 학교 변경
     */
    async onWorkspaceSchoolChange(schoolId) {
        if (!schoolId) return;
        
        console.log('🏫 워크스페이스 학교 변경:', schoolId);
        
        this.currentSchoolId = parseInt(schoolId);
        this.core.currentSchoolId = this.currentSchoolId;
        
        // 평면도 로드 (DataSyncManager.load가 내부에서 applyLoadedData를 호출함)
        try {
            const success = await this.dataSyncManager.load(this.currentSchoolId);
            
            console.log('📥 평면도 로드 결과:', success);
            
            // 요소가 있으면 fitToElements, 없으면 centerView
            if (success && this.core.state.elements && this.core.state.elements.length > 0) {
                this.core.fitToElements();
            } else {
                this.core.centerView();
            }
            
            this.core.markDirty(); // 강제 렌더링
            this.updateZoomDisplay(); // 줌 디스플레이 업데이트
            
            // 교실 설계 모드인 경우 미배치 교실 다시 로드
            if (this.currentMode === 'design-classroom' && this.modeManager && this.modeManager.loadUnplacedClassrooms) {
                this.modeManager.loadUnplacedClassrooms(this.currentSchoolId);
            }
        } catch (error) {
            console.error('❌ 평면도 로드 오류:', error);
            this.elementManager.clearAllElements();
            this.core.centerView();
            this.core.markDirty();
            this.updateZoomDisplay();
        }
    }
    
    /**
     * 워크스페이스 모드 변경
     */
    async onWorkspaceModeChange(mode) {
        if (!mode) return;
        
        console.log('🔄 워크스페이스 모드 변경:', mode);
        
        if (!this.currentSchoolId) {
            alert('먼저 학교를 선택해주세요.');
            document.getElementById('workspace-mode-select').value = '';
            return;
        }
        
        // 기존 모드 종료
        if (this.modeManager && this.modeManager.deactivate) {
            this.modeManager.deactivate();
            this.modeManager = null;
        }
        
        // 새 모드 시작
        await this.switchMode(mode);
        
        // PPT 버튼 표시 여부
        const pptBtn = document.getElementById('workspace-ppt-btn');
        if (pptBtn) {
            pptBtn.style.display = mode.startsWith('view-') ? 'flex' : 'none';
        }
        
        // 도구창 표시/숨김
        const toolbarContainer = document.getElementById('design-toolbar-container');
        if (toolbarContainer) {
            toolbarContainer.style.display = mode.startsWith('design-') ? 'block' : 'none';
        }
        
        // 강제 렌더링
        if (this.core) {
            this.core.markDirty();
        }
    }
    
    /**
     * 현재 작업 저장
     */
    async saveCurrentWork() {
        if (!this.currentSchoolId) {
            alert('학교를 먼저 선택하세요');
            return;
        }
        
        try {
            // 1. 교실 좌표 저장 (교실 설계 모드인 경우)
            if (this.currentMode === 'design-classroom' && this.modeManager) {
                await this.saveClassroomCoordinates();
            }
            
            // 2. 평면도 데이터 저장
            const result = await this.dataSyncManager.save(this.currentSchoolId);
            
            console.log('💾 평면도 저장 결과:', result);
            
            // result가 객체인 경우와 boolean인 경우 모두 처리
            if (result === true || (result && result.success)) {
                this.uiManager.showNotification('저장 완료', 'success');
            } else if (result === false || (result && result.success === false)) {
                const errorMsg = (result && result.message) ? result.message : '알 수 없는 오류';
                this.uiManager.showNotification('저장 실패: ' + errorMsg, 'error');
            }
            // result가 undefined이거나 예상치 못한 형태인 경우는 무시 (이미 성공 알림이 표시됨)
        } catch (error) {
            console.error('저장 오류:', error);
            this.uiManager.showNotification('저장 중 오류 발생', 'error');
        }
    }
    
    /**
     * 교실 좌표 저장
     */
    async saveClassroomCoordinates() {
        const elements = this.core.state.elements;
        const roomElements = elements.filter(el => el.elementType === 'room' && el.classroomId);
        
        if (roomElements.length === 0) {
            console.log('💾 저장할 교실 좌표 없음');
            return;
        }
        
        console.log('💾 교실 좌표 저장 시작:', roomElements.length, '개');
        
        const savePromises = roomElements.map(async (room) => {
            try {
                const requestData = {
                    xCoordinate: Math.round(room.xCoordinate),
                    yCoordinate: Math.round(room.yCoordinate),
                    width: Math.round(room.width),
                    height: Math.round(room.height)
                };
                
                const response = await fetch(`/floorplan/api/classrooms/${room.classroomId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    const responseData = await response.json();
                    console.error(`❌ 교실 좌표 저장 실패 - ${room.label} (ID: ${room.classroomId})`, responseData);
                    return false;
                }
                
                console.log(`✅ 교실 좌표 저장: ${room.label}`);
                return true;
            } catch (error) {
                console.error(`❌ 교실 좌표 저장 오류 - ${room.label} (ID: ${room.classroomId}):`, error);
                return false;
            }
        });
        
        const results = await Promise.all(savePromises);
        const successCount = results.filter(r => r).length;
        
        console.log(`💾 교실 좌표 저장 완료: ${successCount}/${roomElements.length}`);
        
        if (successCount < roomElements.length) {
            this.uiManager.showNotification(
                `일부 교실 저장 실패 (${successCount}/${roomElements.length})`,
                'warning'
            );
        }
    }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.floorPlanApp = new FloorPlanApp();
    window.floorPlanApp.init();
});

export default FloorPlanApp;

