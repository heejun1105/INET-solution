/**
 * HistoryManager.js
 * 작업 히스토리 관리 (되돌리기/다시실행)
 * 
 * 책임:
 * - 작업 히스토리 저장
 * - 되돌리기 (Undo)
 * - 다시 실행 (Redo)
 * - 히스토리 제한 관리
 */

export default class HistoryManager {
    /**
     * @param {FloorPlanCore} core - FloorPlanCore 인스턴스
     */
    constructor(core) {
        if (!core) {
            throw new Error('FloorPlanCore instance is required');
        }
        
        console.log('⏮️ HistoryManager 초기화 시작');
        
        this.core = core;
        
        // 히스토리 스택
        this.undoStack = [];
        this.redoStack = [];
        
        // 히스토리 제한 (메모리 관리)
        this.maxHistorySize = 50;
        
        // 히스토리 저장 중 플래그 (무한 루프 방지)
        this.isRestoring = false;
        
        console.log('✅ HistoryManager 초기화 완료');
    }
    
    /**
     * 현재 상태 스냅샷 저장
     */
    saveState(description = '작업') {
        // 복원 중에는 히스토리 저장 안 함
        if (this.isRestoring) {
            return;
        }
        
        const elements = this.core.state.elements || [];
        
        // 요소 배열의 깊은 복사 (JSON 직렬화/역직렬화 사용)
        const snapshot = {
            elements: JSON.parse(JSON.stringify(elements)),
            description: description,
            timestamp: Date.now()
        };
        
        // 새 작업이 추가되면 redo 스택 초기화
        this.redoStack = [];
        
        // undo 스택에 추가
        this.undoStack.push(snapshot);
        
        // 최대 크기 제한
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift(); // 가장 오래된 항목 제거
        }
        
        console.log(`💾 히스토리 저장: ${description} (총 ${this.undoStack.length}개)`);
    }
    
    /**
     * 되돌리기 (Undo)
     */
    undo() {
        if (this.undoStack.length === 0) {
            console.log('⚠️ 되돌릴 작업이 없습니다');
            return false;
        }
        
        // 현재 상태를 redo 스택에 저장
        const currentElements = this.core.state.elements || [];
        const currentSnapshot = {
            elements: JSON.parse(JSON.stringify(currentElements)),
            description: 'Current',
            timestamp: Date.now()
        };
        this.redoStack.push(currentSnapshot);
        
        // undo 스택에서 이전 상태 가져오기
        const previousState = this.undoStack.pop();
        
        // 상태 복원
        this.restoreState(previousState);
        
        console.log(`⏮️ 되돌리기: ${previousState.description} (남은 undo: ${this.undoStack.length})`);
        
        return true;
    }
    
    /**
     * 다시 실행 (Redo)
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('⚠️ 다시 실행할 작업이 없습니다');
            return false;
        }
        
        // 현재 상태를 undo 스택에 저장
        const currentElements = this.core.state.elements || [];
        const currentSnapshot = {
            elements: JSON.parse(JSON.stringify(currentElements)),
            description: 'Current',
            timestamp: Date.now()
        };
        this.undoStack.push(currentSnapshot);
        
        // redo 스택에서 다음 상태 가져오기
        const nextState = this.redoStack.pop();
        
        // 상태 복원
        this.restoreState(nextState);
        
        console.log(`⏭️ 다시 실행: ${nextState.description} (남은 redo: ${this.redoStack.length})`);
        
        return true;
    }
    
    /**
     * 상태 복원
     */
    restoreState(snapshot) {
        this.isRestoring = true;
        
        try {
            // 요소 복원
            const restoredElements = JSON.parse(JSON.stringify(snapshot.elements));
            
            // Core 상태 업데이트
            this.core.setState({
                elements: restoredElements,
                selectedElements: [] // 선택 해제
            });
            
            // 렌더링
            this.core.markDirty();
            
        } finally {
            this.isRestoring = false;
        }
    }
    
    /**
     * 히스토리 초기화
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        console.log('🗑️ 히스토리 초기화');
    }
    
    /**
     * 되돌리기 가능 여부
     */
    canUndo() {
        return this.undoStack.length > 0;
    }
    
    /**
     * 다시 실행 가능 여부
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * 히스토리 정보 가져오기
     */
    getHistoryInfo() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}

