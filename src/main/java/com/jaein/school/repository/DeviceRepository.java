package com.jaein.school.repository;

import com.jaein.school.entity.Device;
import com.jaein.school.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    List<Device> findBySchool(School school);
} 