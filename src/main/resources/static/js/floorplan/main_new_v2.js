/**
 * main_new_v2.js
 * 평면도 시스템 메인 진입점 (재구축 버전)
 * 
 * 새로운 아키텍처:
 * - FloorPlanCore: 캔버스 엔진 및 상태 관리
 * - InteractionManager: 사용자 입력 통합
 * - ElementManager: 요소 CRUD
 * - DataSyncManager: 서버 동기화
 * - UIManager: UI 통합
 */

import FloorPlanCore from './core/FloorPlanCore.js';
import InteractionManager from './core/InteractionManager.js';
import ElementManager from './core/ElementManager.js';
import DataSyncManager from './core/DataSyncManager.js';
import UIManager from './core/UIManager.js';

/**
 * 평면도 애플리케이션 클래스
 */
class FloorPlanApplication {
    constructor() {
        console.log('🚀 평면도 애플리케이션 초기화 시작');
        
        // 매니저 인스턴스
        this.core = null;
        this.interactionManager = null;
        this.elementManager = null;
        this.dataSyncManager = null;
        this.uiManager = null;
        
        // 현재 모드
        this.currentMode = null; // 'design' 또는 'view'
        
        // 학교 목록
        this.schools = [];
        
        console.log('✅ 평면도 애플리케이션 초기화 완료');
    }
    
    /**
     * 애플리케이션 초기화
     */
    init() {
        console.log('📦 애플리케이션 초기화');
        
        // 모드 선택 버튼 이벤트
        this.setupModeButtons();
        
        // 학교 목록 가져오기
        this.loadSchools();
    }
    
    /**
     * 모드 선택 버튼 설정
     */
    setupModeButtons() {
        const designModeBtn = document.getElementById('designModeBtn');
        const viewModeBtn = document.getElementById('viewModeBtn');
        
        if (designModeBtn) {
            designModeBtn.addEventListener('click', () => {
                this.enterDesignMode();
            });
        }
        
        if (viewModeBtn) {
            viewModeBtn.addEventListener('click', () => {
                this.enterViewMode();
            });
        }
    }
    
    /**
     * 학교 목록 로드
     */
    async loadSchools() {
        try {
            // 서버에서 학교 목록 가져오기
            // 현재 페이지에서 th:inline으로 주입된 schools 변수 사용
            if (typeof schools !== 'undefined') {
                this.schools = schools;
                console.log('📋 학교 목록 로드:', this.schools.length, '개');
            }
        } catch (error) {
            console.error('학교 목록 로드 실패:', error);
        }
    }
    
    /**
     * 설계 모드 진입
     */
    async enterDesignMode() {
        console.log('🎨 설계 모드 진입');
        
        this.currentMode = 'design';
        
        // UI 업데이트
        document.getElementById('designModeBtn')?.classList.add('active');
        document.getElementById('viewModeBtn')?.classList.remove('active');
        
        // 전체화면 컨테이너 생성
        const designContainer = this.createDesignContainer();
        document.body.appendChild(designContainer);
        
        // 캔버스 컨테이너
        const canvasContainer = designContainer.querySelector('#design-canvas-container');
        
        // 매니저들 초기화
        this.core = new FloorPlanCore(canvasContainer, {
            canvasWidth: 4000,
            canvasHeight: 2500,
            zoom: 1.0,
            gridSize: 20,
            showGrid: true,
            snapToGrid: true
        });
        
        this.interactionManager = new InteractionManager(this.core);
        this.elementManager = new ElementManager(this.core);
        this.dataSyncManager = new DataSyncManager(this.core);
        this.uiManager = new UIManager(this.core, this.dataSyncManager, this.elementManager);
        
        // UI 생성
        this.uiManager.createDesignToolbar(designContainer);
        this.uiManager.createStatusBar(designContainer);
        this.uiManager.setupKeyboardShortcuts();
        
        // 학교 선택 모달 표시
        if (this.schools.length > 0) {
            this.uiManager.showSchoolSelectModal(this.schools);
        }
        
        // 전역 참조 (호환성)
        window.floorPlanApp = this;
        window.exitDesignMode = () => this.exitDesignMode();
        
        console.log('✅ 설계 모드 준비 완료');
    }
    
    /**
     * 설계 모드 종료
     */
    exitDesignMode() {
        console.log('🚪 설계 모드 종료');
        
        this.currentMode = null;
        
        // 매니저들 정리
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }
        
        if (this.interactionManager) {
            this.interactionManager.destroy();
            this.interactionManager = null;
        }
        
        if (this.dataSyncManager) {
            this.dataSyncManager.destroy();
            this.dataSyncManager = null;
        }
        
        if (this.core) {
            this.core.destroy();
            this.core = null;
        }
        
        this.elementManager = null;
        
        // 설계 컨테이너 제거
        const designContainer = document.getElementById('design-mode-container');
        if (designContainer) {
            designContainer.remove();
        }
        
        // UI 업데이트
        document.getElementById('designModeBtn')?.classList.remove('active');
        document.getElementById('viewModeBtn')?.classList.remove('active');
        
        console.log('✅ 설계 모드 종료 완료');
    }
    
    /**
     * 보기 모드 진입
     */
    async enterViewMode() {
        console.log('👁️ 보기 모드 진입');
        
        this.currentMode = 'view';
        
        // UI 업데이트
        document.getElementById('designModeBtn')?.classList.remove('active');
        document.getElementById('viewModeBtn')?.classList.add('active');
        document.getElementById('viewModeContainer')?.classList.add('active');
        
        // 보기 모드 구현 (기존 코드 유지 또는 재구현)
        console.log('ℹ️ 보기 모드는 기존 구현 사용');
    }
    
    /**
     * 설계 컨테이너 생성
     */
    createDesignContainer() {
        const container = document.createElement('div');
        container.id = 'design-mode-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #f8f9fa;
            z-index: 999;
            display: flex;
            flex-direction: column;
        `;
        
        container.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 600;">
                        <i class="fas fa-pencil-ruler"></i> 평면도 설계 모드
                    </h1>
                    <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">
                        드래그하여 요소를 이동하고, 마우스 휠로 확대/축소하세요
                    </p>
                </div>
                <button 
                    onclick="window.exitDesignMode()" 
                    style="
                        padding: 8px 16px;
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.2)'"
                >
                    <i class="fas fa-times"></i> 종료
                </button>
            </div>
            
            <div id="design-canvas-container" style="
                flex: 1;
                position: relative;
                overflow: hidden;
            "></div>
        `;
        
        return container;
    }
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌟 평면도 시스템 시작');
    
    const app = new FloorPlanApplication();
    app.init();
    
    // 전역 참조
    window.floorPlanApp = app;
});

