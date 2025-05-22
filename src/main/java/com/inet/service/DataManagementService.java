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
    private final EntityManager entityManager;
    private final SchoolRepository schoolRepository;

    @Autowired
    public DataManagementService(
            DeviceRepository deviceRepository,
            ClassroomRepository classroomRepository,
            ManageRepository manageRepository,
            OperatorRepository operatorRepository,
            UidRepository uidRepository,
            EntityManager entityManager,
            SchoolRepository schoolRepository) {
        this.deviceRepository = deviceRepository;
        this.classroomRepository = classroomRepository;
        this.manageRepository = manageRepository;
        this.operatorRepository = operatorRepository;
        this.uidRepository = uidRepository;
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
            long classroomCount = classroomRepository.countBySchoolSchoolId(schoolId);
            long operatorCount = operatorRepository.countBySchoolSchoolId(schoolId);
            long manageCount = manageRepository.countBySchoolSchoolId(schoolId);
            long uidCount = uidRepository.countBySchoolSchoolId(schoolId);
            
            logger.info("Found records to delete - Devices: {}, Classrooms: {}, Operators: {}, Manages: {}, UIDs: {}", 
                deviceCount, classroomCount, operatorCount, manageCount, uidCount);

            // 3. 외래키 제약조건 비활성화
            entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
            
            try {
                // 4. Device 삭제
                int deletedDevices = deviceRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedDevices;
                logger.debug("Deleted {} devices", deletedDevices);
                
                // 5. UID 삭제
                int deletedUids = uidRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedUids;
                logger.debug("Deleted {} uids", deletedUids);
                
                // 6. Operator 삭제
                int deletedOperators = operatorRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedOperators;
                logger.debug("Deleted {} operators", deletedOperators);
                
                // 7. Classroom 삭제
                int deletedClassrooms = classroomRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedClassrooms;
                logger.debug("Deleted {} classrooms", deletedClassrooms);
                
                // 8. Manage 삭제
                int deletedManages = manageRepository.deleteBySchoolSchoolId(schoolId);
                totalRecordsDeleted += deletedManages;
                logger.debug("Deleted {} manages", deletedManages);
                
            } finally {
                // 9. 외래키 제약조건 다시 활성화
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
            }

            // 10. 삭제 결과 검증
            long remainingDevices = deviceRepository.countBySchoolSchoolId(schoolId);
            long remainingClassrooms = classroomRepository.countBySchoolSchoolId(schoolId);
            long remainingOperators = operatorRepository.countBySchoolSchoolId(schoolId);
            long remainingManages = manageRepository.countBySchoolSchoolId(schoolId);
            long remainingUids = uidRepository.countBySchoolSchoolId(schoolId);

            if (remainingDevices > 0 || remainingClassrooms > 0 || remainingOperators > 0 || 
                remainingManages > 0 || remainingUids > 0) {
                String errorMsg = String.format(
                    "데이터 삭제가 완전하지 않습니다. 남은 레코드 - Devices: %d, Classrooms: %d, Operators: %d, Manages: %d, UIDs: %d",
                    remainingDevices, remainingClassrooms, remainingOperators, remainingManages, remainingUids);
                logger.error(errorMsg);
                throw new RuntimeException(errorMsg);
            }

            // 11. 처리 결과 로깅
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
}