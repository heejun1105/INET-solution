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
            EntityManager entityManager,
            SchoolRepository schoolRepository) {
        this.deviceRepository = deviceRepository;
        this.classroomRepository = classroomRepository;
        this.manageRepository = manageRepository;
        this.operatorRepository = operatorRepository;
        this.uidRepository = uidRepository;
        this.wirelessApRepository = wirelessApRepository;
        this.entityManager = entityManager;
        this.schoolRepository = schoolRepository;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional(isolation = Isolation.SERIALIZABLE)
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
            
            logger.info("Found records to delete - Devices: {}, WirelessAPs: {}, Classrooms: {}, Operators: {}, Manages: {}, UIDs: {}", 
                deviceCount, wirelessApCount, classroomCount, operatorCount, manageCount, uidCount);

            // 3. 외래키 제약조건 비활성화
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
            
            try {
                // 4. Device 삭제
                int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedDevices;
                logger.debug("Deleted {} devices", deletedDevices);
                
                // 5. WirelessAp 삭제
                int deletedWirelessAps = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedWirelessAps;
                logger.debug("Deleted {} wireless APs", deletedWirelessAps);
                
                // 6. UID 삭제
                int deletedUids = uidRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedUids;
                logger.debug("Deleted {} uids", deletedUids);
                
                // 7. Operator 삭제
                int deletedOperators = operatorRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedOperators;
                logger.debug("Deleted {} operators", deletedOperators);
                
                // 8. Classroom 삭제
                int deletedClassrooms = classroomRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedClassrooms;
                logger.debug("Deleted {} classrooms", deletedClassrooms);
                
                // 9. Manage 삭제
                int deletedManages = manageRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedManages;
                logger.debug("Deleted {} manages", deletedManages);
                
            } finally {
                // 10. 외래키 제약조건 다시 활성화
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            }

            // 11. 삭제 결과 검증
            long remainingDevices = deviceRepository.countBySchoolSchoolId(schoolId);
            long remainingWirelessAps = wirelessApRepository.countBySchoolSchoolId(schoolId);
            long remainingClassrooms = classroomRepository.countBySchoolSchoolId(schoolId);
            long remainingOperators = operatorRepository.countBySchoolSchoolId(schoolId);
            long remainingManages = manageRepository.countBySchoolSchoolId(schoolId);
            long remainingUids = uidRepository.countBySchoolSchoolId(schoolId);

            if (remainingDevices > 0 || remainingWirelessAps > 0 || remainingClassrooms > 0 || remainingOperators > 0 || 
                remainingManages > 0 || remainingUids > 0) {
                String errorMsg = String.format(
                    "데이터 삭제가 완전하지 않습니다. 남은 레코드 - Devices: %d, WirelessAPs: %d, Classrooms: %d, Operators: %d, Manages: %d, UIDs: %d",
                    remainingDevices, remainingWirelessAps, remainingClassrooms, remainingOperators, remainingManages, remainingUids);
                logger.error(errorMsg);
                throw new RuntimeException(errorMsg);
            }

            // 12. 처리 결과 로깅
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
        int deletedCount = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
        logger.info("Deleted {} wireless APs for school: {}", deletedCount, schoolId);
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

    @Transactional
    public void deleteSelectedDataTypes(Long schoolId, boolean deleteDevices, boolean deleteWirelessAps) {
        logger.info("Deleting selected data types for school: {} (devices: {}, wirelessAPs: {})", 
                   schoolId, deleteDevices, deleteWirelessAps);
        
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 학교입니다: " + schoolId));
        
        int totalDeleted = 0;
        
        if (deleteDevices) {
            int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedDevices;
            logger.debug("Deleted {} devices", deletedDevices);
        }
        
        if (deleteWirelessAps) {
            int deletedWirelessAps = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedWirelessAps;
            logger.debug("Deleted {} wireless APs", deletedWirelessAps);
        }
        
        logger.info("Successfully deleted {} records for school: {}", totalDeleted, school.getSchoolName());
    }

    @Transactional
    public void deleteSelectedDataTypes(Long schoolId, boolean deleteDevices, boolean deleteWirelessAps, 
                                       boolean deleteClassrooms, boolean deleteOperators, 
                                       boolean deleteManages, boolean deleteUids) {
        logger.info("Deleting selected data types for school: {} (devices: {}, wirelessAPs: {}, classrooms: {}, operators: {}, manages: {}, uids: {})", 
                   schoolId, deleteDevices, deleteWirelessAps, deleteClassrooms, deleteOperators, deleteManages, deleteUids);
        
        School school = schoolRepository.findById(schoolId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 학교입니다: " + schoolId));
        
        int totalDeleted = 0;
        
        // 외래키 제약조건을 고려한 삭제 순서
        if (deleteDevices) {
            int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedDevices;
            logger.debug("Deleted {} devices", deletedDevices);
        }
        
        if (deleteWirelessAps) {
            int deletedWirelessAps = wirelessApRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedWirelessAps;
            logger.debug("Deleted {} wireless APs", deletedWirelessAps);
        }
        
        if (deleteUids) {
            int deletedUids = uidRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedUids;
            logger.debug("Deleted {} uids", deletedUids);
        }
        
        if (deleteOperators) {
            int deletedOperators = operatorRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedOperators;
            logger.debug("Deleted {} operators", deletedOperators);
        }
        
        if (deleteManages) {
            int deletedManages = manageRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedManages;
            logger.debug("Deleted {} manages", deletedManages);
        }
        
        // 교실은 마지막에 삭제 (device와 wireless_ap가 참조할 수 있음)
        if (deleteClassrooms) {
            int deletedClassrooms = classroomRepository.deleteBySchoolSchoolId(schoolId);
            totalDeleted += deletedClassrooms;
            logger.debug("Deleted {} classrooms", deletedClassrooms);
        }
        
        logger.info("Successfully deleted {} records for school: {}", totalDeleted, school.getSchoolName());
    }
}