package com.inet.service;

import com.inet.entity.DeviceInspectionStatus;
import com.inet.repository.DeviceInspectionStatusRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class DeviceInspectionStatusService {
    
    private final DeviceInspectionStatusRepository deviceInspectionStatusRepository;
    
    public DeviceInspectionStatusService(DeviceInspectionStatusRepository deviceInspectionStatusRepository) {
        this.deviceInspectionStatusRepository = deviceInspectionStatusRepository;
    }
    
    /**
     * 장비 검사 상태 저장 또는 업데이트
     */
    public DeviceInspectionStatus saveInspectionStatus(Long deviceId, Long schoolId, Long inspectorId, String status) {
        Optional<DeviceInspectionStatus> existing = deviceInspectionStatusRepository
            .findByDeviceIdAndSchoolIdAndInspectorId(deviceId, schoolId, inspectorId);
        
        DeviceInspectionStatus inspectionStatus;
        
        if (existing.isPresent()) {
            // 기존 상태 업데이트
            inspectionStatus = existing.get();
            inspectionStatus.setInspectionStatus(DeviceInspectionStatus.InspectionStatus.fromValue(status));
        } else {
            // 새로운 상태 생성
            inspectionStatus = new DeviceInspectionStatus();
            inspectionStatus.setDeviceId(deviceId);
            inspectionStatus.setSchoolId(schoolId);
            inspectionStatus.setInspectorId(inspectorId);
            inspectionStatus.setInspectionStatus(DeviceInspectionStatus.InspectionStatus.fromValue(status));
        }
        
        return deviceInspectionStatusRepository.save(inspectionStatus);
    }
    
    /**
     * 특정 학교의 모든 검사 상태들 조회
     */
    @Transactional(readOnly = true)
    public Map<Long, String> getInspectionStatuses(Long schoolId, Long inspectorId) {
        List<DeviceInspectionStatus> statuses = deviceInspectionStatusRepository
            .findBySchoolIdAndInspectorId(schoolId, inspectorId);
        
        return statuses.stream()
            .collect(Collectors.toMap(
                DeviceInspectionStatus::getDeviceId,
                status -> status.getInspectionStatus().getValue()
            ));
    }
    
    /**
     * 특정 장비의 현재 검사 상태 조회
     */
    @Transactional(readOnly = true)
    public Optional<DeviceInspectionStatus> getInspectionStatus(
            Long deviceId, Long schoolId, Long inspectorId) {
        return deviceInspectionStatusRepository
            .findByDeviceIdAndSchoolIdAndInspectorId(deviceId, schoolId, inspectorId);
    }
    
    /**
     * 특정 장비의 검사 상태 삭제
     */
    public void deleteInspectionStatus(Long deviceId, Long schoolId, Long inspectorId) {
        deviceInspectionStatusRepository.deleteByDeviceIdAndSchoolIdAndInspectorId(
            deviceId, schoolId, inspectorId);
    }
}