package com.inet.service;

import com.inet.repository.*;
import com.inet.entity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.retry.annotation.Retryable;
import org.springframework.retry.annotation.Backoff;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class DataManagementService {
    
    private static final Logger logger = LoggerFactory.getLogger(DataManagementService.class);
    
    private final DeviceRepository deviceRepository;
    private final ClassroomRepository classroomRepository;
    private final ManageRepository manageRepository;
    private final OperatorRepository operatorRepository;
    private final UidRepository uidRepository;
    private final WirelessApRepository wirelessApRepository;
    private final DeviceHistoryRepository deviceHistoryRepository;
    private final WirelessApHistoryRepository wirelessApHistoryRepository;
    private final DeviceInspectionStatusRepository deviceInspectionStatusRepository;
    private final DeviceInspectionHistoryRepository deviceInspectionHistoryRepository;
    private final DeviceLocationRepository deviceLocationRepository;
    private final WirelessApLocationRepository wirelessApLocationRepository;
    private final FloorPlanRepository floorPlanRepository;
    private final FloorPlanElementRepository floorPlanElementRepository;
    private final NetworkEquipmentRepository networkEquipmentRepository;
    private final BuildingRepository buildingRepository;
    private final FloorRoomRepository floorRoomRepository;
    private final RoomSeatRepository roomSeatRepository;
    private final EntityManager entityManager;
    private final SchoolRepository schoolRepository;

    @Autowired
    public DataManagementService(
            DeviceRepository deviceRepository,
            ClassroomRepository classroomRepository,
            ManageRepository manageRepository,
            OperatorRepository operatorRepository,
            UidRepository uidRepository,
            WirelessApRepository wirelessApRepository,
            DeviceHistoryRepository deviceHistoryRepository,
            WirelessApHistoryRepository wirelessApHistoryRepository,
            DeviceInspectionStatusRepository deviceInspectionStatusRepository,
            DeviceInspectionHistoryRepository deviceInspectionHistoryRepository,
            DeviceLocationRepository deviceLocationRepository,
            WirelessApLocationRepository wirelessApLocationRepository,
            FloorPlanRepository floorPlanRepository,
            FloorPlanElementRepository floorPlanElementRepository,
            NetworkEquipmentRepository networkEquipmentRepository,
            BuildingRepository buildingRepository,
            FloorRoomRepository floorRoomRepository,
            RoomSeatRepository roomSeatRepository,
            EntityManager entityManager,
            SchoolRepository schoolRepository) {
        this.deviceRepository = deviceRepository;
        this.classroomRepository = classroomRepository;
        this.manageRepository = manageRepository;
        this.operatorRepository = operatorRepository;
        this.uidRepository = uidRepository;
        this.wirelessApRepository = wirelessApRepository;
        this.deviceHistoryRepository = deviceHistoryRepository;
        this.wirelessApHistoryRepository = wirelessApHistoryRepository;
        this.deviceInspectionStatusRepository = deviceInspectionStatusRepository;
        this.deviceInspectionHistoryRepository = deviceInspectionHistoryRepository;
        this.deviceLocationRepository = deviceLocationRepository;
        this.wirelessApLocationRepository = wirelessApLocationRepository;
        this.floorPlanRepository = floorPlanRepository;
        this.floorPlanElementRepository = floorPlanElementRepository;
        this.networkEquipmentRepository = networkEquipmentRepository;
        this.buildingRepository = buildingRepository;
        this.floorRoomRepository = floorRoomRepository;
        this.roomSeatRepository = roomSeatRepository;
        this.entityManager = entityManager;
        this.schoolRepository = schoolRepository;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(isolation = Isolation.READ_COMMITTED)
    @Retryable(
        value = { DataIntegrityViolationException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000)
    )
    public void deleteSchoolData(Long schoolId) {
        long startTime = System.currentTimeMillis();
        logger.info("Starting deletion of school data for schoolId: {}", schoolId);
        int totalRecordsDeleted = 0;

        try {
            // 1. 학교 존재 여부 확인
            School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 학교입니다: " + schoolId));
            
            // 2. 삭제 전 데이터 수 확인
            long deviceCount = deviceRepository.countBySchoolSchoolId(schoolId);
            long wirelessApCount = wirelessApRepository.countBySchoolSchoolId(schoolId);
            long classroomCount = classroomRepository.countBySchoolSchoolId(schoolId);
            long operatorCount = operatorRepository.countBySchoolSchoolId(schoolId);
            long manageCount = manageRepository.countBySchoolSchoolId(schoolId);
            long uidCount = uidRepository.countBySchoolSchoolId(schoolId);
            long deviceHistoryCount = deviceHistoryRepository.countByDeviceSchoolSchoolId(schoolId);
            long wirelessApHistoryCount = wirelessApHistoryRepository.countByWirelessApSchoolSchoolId(schoolId);
            
            logger.info("Found records to delete - Devices: {}, WirelessAPs: {}, Classrooms: {}, Operators: {}, Manages: {}, UIDs: {}, DeviceHistory: {}, WirelessApHistory: {}", 
                deviceCount, wirelessApCount, classroomCount, operatorCount, manageCount, uidCount, deviceHistoryCount, wirelessApHistoryCount);

            // 3. 외래키 제약조건 비활성화
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
            
            try {
                // 삭제 순서: 참조하는 데이터 먼저 삭제
                
                // 1단계: 검사 데이터 삭제
                int deletedInspectionStatus = deviceInspectionStatusRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedInspectionStatus;
                logger.debug("Deleted {} device inspection status records", deletedInspectionStatus);
                
                int deletedInspectionHistory = deviceInspectionHistoryRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedInspectionHistory;
                logger.debug("Deleted {} device inspection history records", deletedInspectionHistory);
                
                // 2단계: 히스토리 삭제
                int deletedDeviceHistory = deviceHistoryRepository.deleteByDeviceSchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedDeviceHistory;
                logger.debug("Deleted {} device history records", deletedDeviceHistory);
                
                int deletedWirelessApHistory = wirelessApHistoryRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedWirelessApHistory;
                logger.debug("Deleted {} wireless AP history records", deletedWirelessApHistory);
                
                // 3단계: 위치 정보 삭제
                int deletedDeviceLocations = deviceLocationRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedDeviceLocations;
                logger.debug("Deleted {} device location records", deletedDeviceLocations);
                
                int deletedWirelessApLocations = wirelessApLocationRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedWirelessApLocations;
                logger.debug("Deleted {} wireless AP location records", deletedWirelessApLocations);
                
                // 4단계: 장비/AP 삭제
                int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedDevices;
                logger.debug("Deleted {} devices", deletedDevices);
                
                int deletedWirelessAps = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedWirelessAps;
                logger.debug("Deleted {} wireless APs", deletedWirelessAps);
                
                // 5단계: 평면도 관련 삭제 (순서 중요)
                // 5-1. 평면도 ID 목록 조회
                List<FloorPlan> floorPlans = floorPlanRepository.findAllBySchoolId(schoolId);
                List<Long> floorPlanIds = floorPlans.stream()
                    .map(FloorPlan::getId)
                    .collect(java.util.stream.Collectors.toList());
                
                // 5-2. 평면도 요소 삭제
                int deletedFloorPlanElements = 0;
                if (!floorPlanIds.isEmpty()) {
                    deletedFloorPlanElements = floorPlanElementRepository.deleteByFloorPlanIds(floorPlanIds);
                    totalRecordsDeleted += deletedFloorPlanElements;
                    logger.debug("Deleted {} floor plan elements", deletedFloorPlanElements);
                }
                
                // 5-3. 평면도 삭제
                int deletedFloorPlans = floorPlanRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedFloorPlans;
                logger.debug("Deleted {} floor plans", deletedFloorPlans);
                
                // 5-4. 네트워크 장비 삭제 (평면도 삭제 시 포함)
                networkEquipmentRepository.deleteBySchool_SchoolId(schoolId);
                logger.debug("Deleted network equipment");
                
                // 5-5. 좌석 삭제
                int deletedRoomSeats = roomSeatRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedRoomSeats;
                logger.debug("Deleted {} room seats", deletedRoomSeats);
                
                // 5-6. 평면도 교실 삭제
                int deletedFloorRooms = floorRoomRepository.deleteBySchoolId(schoolId);
                totalRecordsDeleted += deletedFloorRooms;
                logger.debug("Deleted {} floor rooms", deletedFloorRooms);
                
                // 5-7. 건물 삭제
                int deletedBuildings = buildingRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedBuildings;
                logger.debug("Deleted {} buildings", deletedBuildings);
                
                // 6단계: 교실 삭제
                int deletedClassrooms = classroomRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedClassrooms;
                logger.debug("Deleted {} classrooms", deletedClassrooms);
                
                // 7단계: 참조받는 엔티티들 삭제
                int deletedUids = uidRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedUids;
                logger.debug("Deleted {} uids", deletedUids);
                
                int deletedOperators = operatorRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedOperators;
                logger.debug("Deleted {} operators", deletedOperators);
                
                int deletedManages = manageRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedManages;
                logger.debug("Deleted {} manages", deletedManages);
                
            } finally {
                // 외래키 제약조건 다시 활성화
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            }

            // 삭제 결과 검증
            long remainingDevices = deviceRepository.countBySchoolSchoolId(schoolId);
            long remainingWirelessAps = wirelessApRepository.countBySchoolSchoolId(schoolId);
            long remainingClassrooms = classroomRepository.countBySchoolSchoolId(schoolId);
            long remainingOperators = operatorRepository.countBySchoolSchoolId(schoolId);
            long remainingManages = manageRepository.countBySchoolSchoolId(schoolId);
            long remainingUids = uidRepository.countBySchoolSchoolId(schoolId);
            long remainingDeviceHistory = deviceHistoryRepository.countByDeviceSchoolSchoolId(schoolId);
            long remainingWirelessApHistory = wirelessApHistoryRepository.countByWirelessApSchoolSchoolId(schoolId);

            if (remainingDevices > 0 || remainingWirelessAps > 0 || remainingClassrooms > 0 || remainingOperators > 0 || 
                remainingManages > 0 || remainingUids > 0 || remainingDeviceHistory > 0 || remainingWirelessApHistory > 0) {
                String errorMsg = String.format(
                    "데이터 삭제가 완전하지 않습니다. 남은 레코드 - Devices: %d, WirelessAPs: %d, Classrooms: %d, Operators: %d, Manages: %d, UIDs: %d, DeviceHistory: %d, WirelessApHistory: %d",
                    remainingDevices, remainingWirelessAps, remainingClassrooms, remainingOperators, remainingManages, remainingUids, remainingDeviceHistory, remainingWirelessApHistory);
                logger.error(errorMsg);
                throw new RuntimeException(errorMsg);
            }

            // 14. 처리 결과 로깅
            long endTime = System.currentTimeMillis();
            logger.info("Successfully deleted school data for '{}' in {}ms. Total records deleted: {}", 
                school.getSchoolName(), (endTime - startTime), totalRecordsDeleted);
            
        } catch (Exception e) {
            String errorMsg = String.format("Failed to delete school data for schoolId %d: %s", 
                schoolId, e.getMessage());
            logger.error(errorMsg, e);
            throw new RuntimeException(errorMsg, e);
        }
    }

    // 선택적 데이터 삭제를 위한 새로운 메서드들
    @Transactional
    public void deleteDevicesBySchool(Long schoolId) {
        logger.info("Deleting devices for school: {}", schoolId);
        int deletedCount = deviceRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} devices for school: {}", deletedCount, schoolId);
    }

    @Transactional
    public void deleteWirelessApsBySchool(Long schoolId) {
        logger.info("Deleting wireless APs for school: {}", schoolId);
        // 1) 히스토리 먼저 삭제 (FK 제약 회피)
        try {
            wirelessApHistoryRepository.deleteBySchoolId(schoolId);
            logger.debug("Deleted wireless AP histories for school: {}", schoolId);
        } catch (Exception e) {
            logger.error("Error deleting wireless AP histories for school {}: {}", schoolId, e.getMessage());
            throw new RuntimeException("무선AP 이력 삭제 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
        }

        // 2) AP 삭제
        try {
        int deletedCount = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} wireless APs for school: {}", deletedCount, schoolId);
        } catch (Exception e) {
            logger.error("Error deleting wireless APs for school {}: {}", schoolId, e.getMessage());
            throw new RuntimeException("무선AP 삭제 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
        }
    }

    @Transactional
    public void deleteClassroomsBySchool(Long schoolId) {
        logger.info("Deleting classrooms for school: {}", schoolId);
        int deletedCount = classroomRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} classrooms for school: {}", deletedCount, schoolId);
    }

    @Transactional
    public void deleteOperatorsBySchool(Long schoolId) {
        logger.info("Deleting operators for school: {}", schoolId);
        int deletedCount = operatorRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} operators for school: {}", deletedCount, schoolId);
    }

    @Transactional
    public void deleteManagesBySchool(Long schoolId) {
        logger.info("Deleting manages for school: {}", schoolId);
        int deletedCount = manageRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} manages for school: {}", deletedCount, schoolId);
    }

    @Transactional
    public void deleteUidsBySchool(Long schoolId) {
        logger.info("Deleting uids for school: {}", schoolId);
        int deletedCount = uidRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} uids for school: {}", deletedCount, schoolId);
    }


    /**
     * 학교별 장비 수정내역 삭제 (기간 설정 적용)
     */
    @Transactional
    public int deleteDeviceHistoryBySchool(Long schoolId, String periodType, String deleteBeforeDate) {
        logger.info("Deleting device history for school: {} with period type: {}", schoolId, periodType);
        
        int deletedCount = 0;
        
        if ("all".equals(periodType)) {
            // 전체 기간 삭제
            deletedCount = deviceHistoryRepository.deleteByDeviceSchoolSchoolId(schoolId);
            logger.info("Deleted all {} device history records for school: {}", deletedCount, schoolId);
        } else if ("before".equals(periodType) && deleteBeforeDate != null) {
            // 특정 날짜 이전 삭제
            try {
                java.time.LocalDate beforeDate = java.time.LocalDate.parse(deleteBeforeDate);
                java.time.LocalDateTime beforeDateTime = beforeDate.atStartOfDay();
                deletedCount = deviceHistoryRepository.deleteByDeviceSchoolSchoolIdAndModifiedAtBefore(schoolId, beforeDateTime);
                logger.info("Deleted {} device history records before {} for school: {}", deletedCount, deleteBeforeDate, schoolId);
            } catch (Exception e) {
                logger.error("Error parsing date: {}", deleteBeforeDate, e);
                throw new IllegalArgumentException("잘못된 날짜 형식입니다: " + deleteBeforeDate);
            }
        }
        
        return deletedCount;
    }
    
    /**
     * 학교별 무선AP 수정내역 삭제 (기간 설정 적용)
     */
    @Transactional
    public int deleteWirelessApHistoryBySchool(Long schoolId, String periodType, String deleteBeforeDate) {
        logger.info("Deleting wireless AP history for school: {} with period type: {}", schoolId, periodType);
        
        int deletedCount = 0;
        
        if ("all".equals(periodType)) {
            // 전체 기간 삭제
            deletedCount = wirelessApHistoryRepository.deleteBySchoolId(schoolId);
            logger.info("Deleted all {} wireless AP history records for school: {}", deletedCount, schoolId);
        } else if ("before".equals(periodType) && deleteBeforeDate != null) {
            // 특정 날짜 이전 삭제
            try {
                java.time.LocalDate beforeDate = java.time.LocalDate.parse(deleteBeforeDate);
                java.time.LocalDateTime beforeDateTime = beforeDate.atStartOfDay();
                deletedCount = wirelessApHistoryRepository.deleteBySchoolIdAndModifiedAtBefore(schoolId, beforeDateTime);
                logger.info("Deleted {} wireless AP history records before {} for school: {}", deletedCount, deleteBeforeDate, schoolId);
            } catch (Exception e) {
                logger.error("Error parsing date: {}", deleteBeforeDate, e);
                throw new IllegalArgumentException("잘못된 날짜 형식입니다: " + deleteBeforeDate);
            }
        }
        
        return deletedCount;
    }
    
    /**
     * 학교별 평면도 삭제 (평면도 요소, 평면도, 네트워크 장비, 건물, 평면도 교실, 좌석 포함)
     */
    @Transactional
    public int deleteFloorPlansBySchool(Long schoolId) {
        logger.info("Deleting floor plans for school: {}", schoolId);
        
        int totalDeleted = 0;
        
        try {
            // 1. 평면도 ID 목록 조회
            List<FloorPlan> floorPlans = floorPlanRepository.findAllBySchoolId(schoolId);
            List<Long> floorPlanIds = floorPlans.stream()
                .map(FloorPlan::getId)
                .collect(java.util.stream.Collectors.toList());
            
            // 2. 평면도 요소 삭제
            int deletedElements = 0;
            if (!floorPlanIds.isEmpty()) {
                deletedElements = floorPlanElementRepository.deleteByFloorPlanIds(floorPlanIds);
                totalDeleted += deletedElements;
                logger.debug("Deleted {} floor plan elements", deletedElements);
            }
            
            // 3. 평면도 삭제
            int deletedFloorPlans = floorPlanRepository.deleteBySchoolId(schoolId);
            totalDeleted += deletedFloorPlans;
            logger.debug("Deleted {} floor plans", deletedFloorPlans);
            
            // 4. 네트워크 장비 삭제 (평면도 삭제 시 포함)
            networkEquipmentRepository.deleteBySchool_SchoolId(schoolId);
            logger.debug("Deleted network equipment");
            
            // 5. 좌석 삭제
            int deletedRoomSeats = roomSeatRepository.deleteBySchoolId(schoolId);
            totalDeleted += deletedRoomSeats;
            logger.debug("Deleted {} room seats", deletedRoomSeats);
            
            // 6. 평면도 교실 삭제
            int deletedFloorRooms = floorRoomRepository.deleteBySchoolId(schoolId);
            totalDeleted += deletedFloorRooms;
            logger.debug("Deleted {} floor rooms", deletedFloorRooms);
            
            // 7. 건물 삭제
            int deletedBuildings = buildingRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedBuildings;
            logger.debug("Deleted {} buildings", deletedBuildings);
            
            logger.info("Successfully deleted {} floor plan related records for school: {}", totalDeleted, schoolId);
        } catch (Exception e) {
            logger.error("Error deleting floor plans for school {}: {}", schoolId, e.getMessage());
            throw new RuntimeException("평면도 삭제 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
        }
        
        return totalDeleted;
    }

    @Transactional
    public void deleteSelectedDataTypes(Long schoolId, boolean deleteDevices, boolean deleteWirelessAps, 
                                       boolean deleteClassrooms, boolean deleteOperators, 
                                       boolean deleteManages, boolean deleteUids, boolean deleteDeviceHistory,
                                       boolean deleteWirelessApHistory, boolean deleteFloorPlans,
                                       String periodType, String deleteBeforeDate,
                                       String wirelessApPeriodType, String deleteWirelessApBeforeDate) {
        logger.info("Deleting selected data types for school: {} (devices: {}, wirelessAPs: {}, classrooms: {}, operators: {}, manages: {}, uids: {}, deviceHistory: {}, wirelessApHistory: {}, floorPlans: {}, period: {}, wirelessApPeriod: {})", 
                   schoolId, deleteDevices, deleteWirelessAps, deleteClassrooms, deleteOperators, deleteManages, deleteUids, deleteDeviceHistory, deleteWirelessApHistory, deleteFloorPlans, periodType, wirelessApPeriodType);
        
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new RuntimeException("선택하신 학교 정보를 찾을 수 없습니다. 다시 시도해주세요."));
        
        try {
        
        int totalDeleted = 0;
        
        // 외래키 제약조건을 고려한 안전한 삭제 순서
        
        // 0단계: 검사 데이터 삭제 (장비 삭제 시 함께 삭제)
        if (deleteDevices) {
            try {
                int deletedInspectionStatus = deviceInspectionStatusRepository.deleteBySchoolId(schoolId);
                totalDeleted += deletedInspectionStatus;
                logger.debug("Deleted {} device inspection status records", deletedInspectionStatus);
                
                int deletedInspectionHistory = deviceInspectionHistoryRepository.deleteBySchoolId(schoolId);
                totalDeleted += deletedInspectionHistory;
                logger.debug("Deleted {} device inspection history records", deletedInspectionHistory);
            } catch (Exception e) {
                logger.error("Error deleting inspection data for school {}: {}", schoolId, e.getMessage());
                // 검사 데이터 삭제 실패는 경고만 하고 계속 진행
            }
        }
        
        // 1단계: 참조하는 엔티티들 먼저 삭제 (Device, WirelessAp)
        if (deleteDevices) {
            try {
                // 위치 정보 먼저 삭제
                int deletedDeviceLocations = deviceLocationRepository.deleteBySchoolId(schoolId);
                totalDeleted += deletedDeviceLocations;
                logger.debug("Deleted {} device location records", deletedDeviceLocations);
                
                int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
                totalDeleted += deletedDevices;
                logger.debug("Deleted {} devices", deletedDevices);
            } catch (Exception e) {
                logger.error("Error deleting devices for school {}: {}", schoolId, e.getMessage());
                throw new RuntimeException("장비 삭제 중 오류가 발생했습니다. 장비가 다른 시스템에서 사용 중일 수 있습니다. 관리자에게 문의해주세요.");
            }
        }
        
        if (deleteWirelessAps) {
            try {
                // 1) 위치 정보 먼저 삭제
                int deletedWirelessApLocations = wirelessApLocationRepository.deleteBySchoolId(schoolId);
                totalDeleted += deletedWirelessApLocations;
                logger.debug("Deleted {} wireless AP location records", deletedWirelessApLocations);
                
                // 2) 히스토리 먼저 삭제
                wirelessApHistoryRepository.deleteBySchoolId(schoolId);
                logger.debug("Deleted wireless AP histories for school {}", schoolId);

                // 3) AP 삭제
                int deletedWirelessAps = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
                totalDeleted += deletedWirelessAps;
                logger.debug("Deleted {} wireless APs", deletedWirelessAps);
            } catch (Exception e) {
                logger.error("Error deleting wireless APs for school {}: {}", schoolId, e.getMessage());
                throw new RuntimeException("무선AP 삭제 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
            }
        }
        
        // 2단계: 교실 삭제 (Device와 WirelessAp가 참조할 수 있으므로 참조 해제 후 삭제)
        if (deleteClassrooms) {
            try {
                // 장비가 삭제되지 않았다면 교실 참조를 먼저 해제
                if (!deleteDevices) {
                    int updatedDevices = deviceRepository.updateClassroomToNullBySchoolId(schoolId);
                    logger.debug("Updated {} devices to remove classroom references", updatedDevices);
                }
                
                // 무선AP가 삭제되지 않았다면 교실 참조를 먼저 해제  
                if (!deleteWirelessAps) {
                    int updatedWirelessAps = wirelessApRepository.updateClassroomToNullBySchoolId(schoolId);
                    logger.debug("Updated {} wireless APs to remove classroom references", updatedWirelessAps);
                }
                
                // 이제 안전하게 교실 삭제
                int deletedClassrooms = classroomRepository.deleteBySchoolSchoolId(schoolId);
                totalDeleted += deletedClassrooms;
                logger.debug("Deleted {} classrooms", deletedClassrooms);
                
            } catch (Exception e) {
                logger.error("Error deleting classrooms for school {}: {}", schoolId, e.getMessage());
                if (e.getMessage().contains("foreign key constraint")) {
                    throw new RuntimeException("교실 삭제 중 오류가 발생했습니다. 해당 교실에 등록된 장비나 무선AP가 있습니다. 먼저 장비와 무선AP를 함께 삭제하거나, 장비 관리 페이지에서 교실 배정을 해제해주세요.");
                } else {
                    throw new RuntimeException("교실 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                }
            }
        }
        
        // 3단계: 참조받는 엔티티들 삭제 (Uid, Manage, Operator)
        if (deleteUids) {
            try {
            int deletedUids = uidRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedUids;
            logger.debug("Deleted {} uids", deletedUids);
            } catch (Exception e) {
                logger.error("Error deleting UIDs for school {}: {}", schoolId, e.getMessage());
                if (e.getMessage().contains("foreign key constraint")) {
                    throw new RuntimeException("고유번호 삭제 중 오류가 발생했습니다. 해당 고유번호를 사용하는 장비가 있습니다. 먼저 해당 장비들을 함께 삭제해주세요.");
                } else {
                    throw new RuntimeException("고유번호 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                }
            }
        }
        
        if (deleteManages) {
            try {
            int deletedManages = manageRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedManages;
            logger.debug("Deleted {} manages", deletedManages);
            } catch (Exception e) {
                logger.error("Error deleting manages for school {}: {}", schoolId, e.getMessage());
                if (e.getMessage().contains("foreign key constraint")) {
                    throw new RuntimeException("관리번호 삭제 중 오류가 발생했습니다. 해당 관리번호를 사용하는 장비가 있습니다. 먼저 해당 장비들을 함께 삭제해주세요.");
                } else {
                    throw new RuntimeException("관리번호 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                }
            }
        }
        
        if (deleteOperators) {
            try {
                int deletedOperators = operatorRepository.deleteBySchoolSchoolId(schoolId);
                totalDeleted += deletedOperators;
                logger.debug("Deleted {} operators", deletedOperators);
            } catch (Exception e) {
                logger.error("Error deleting operators for school {}: {}", schoolId, e.getMessage());
                if (e.getMessage().contains("foreign key constraint")) {
                    throw new RuntimeException("운영자 삭제 중 오류가 발생했습니다. 해당 운영자가 담당하는 장비가 있습니다. 먼저 해당 장비들을 함께 삭제하거나 다른 운영자로 변경해주세요.");
                } else {
                    throw new RuntimeException("운영자 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                }
            }
        }
        
        // 장비 수정내역 삭제 (기간 설정 적용)
        if (deleteDeviceHistory) {
            try {
            int deletedHistory = deleteDeviceHistoryBySchool(schoolId, periodType, deleteBeforeDate);
            totalDeleted += deletedHistory;
            logger.debug("Deleted {} device history records", deletedHistory);
            } catch (Exception e) {
                logger.error("Error deleting device history for school {}: {}", schoolId, e.getMessage());
                throw new RuntimeException("장비 수정내역 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        }
        
        // 무선AP 수정내역 삭제 (기간 설정 적용)
        if (deleteWirelessApHistory) {
            try {
                int deletedWirelessApHistory = deleteWirelessApHistoryBySchool(schoolId, wirelessApPeriodType, deleteWirelessApBeforeDate);
                totalDeleted += deletedWirelessApHistory;
                logger.debug("Deleted {} wireless AP history records", deletedWirelessApHistory);
            } catch (Exception e) {
                logger.error("Error deleting wireless AP history for school {}: {}", schoolId, e.getMessage());
                throw new RuntimeException("무선AP 수정내역 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        }
        
        // 평면도 삭제
        if (deleteFloorPlans) {
            try {
                int deletedFloorPlans = deleteFloorPlansBySchool(schoolId);
                totalDeleted += deletedFloorPlans;
                logger.debug("Deleted {} floor plan related records", deletedFloorPlans);
            } catch (Exception e) {
                logger.error("Error deleting floor plans for school {}: {}", schoolId, e.getMessage());
                throw new RuntimeException("평면도 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        }
        
        logger.info("Successfully deleted {} records for school: {}", totalDeleted, school.getSchoolName());
        
        } catch (RuntimeException e) {
            // 사용자 친화적인 메시지는 그대로 전달
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error during data deletion for school {}: {}", schoolId, e.getMessage(), e);
            throw new RuntimeException("데이터 삭제 중 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.");
        }
    }
}