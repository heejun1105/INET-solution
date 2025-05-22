package com.jaein.school.service;

import com.jaein.school.entity.Device;
import com.jaein.school.entity.School;
import com.jaein.school.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;

    public List<Device> findDevicesBySchool(School school) {
        return deviceRepository.findBySchool(school);
    }
} 