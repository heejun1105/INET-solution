package com.inet.controller;

import com.inet.entity.Device;
import com.inet.entity.School;
import com.inet.service.DeviceService;
import com.inet.service.SchoolService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.HashMap;

@Controller
@RequestMapping("/ip")
public class IpController {

    private static final Logger logger = LoggerFactory.getLogger(IpController.class);
    private final DeviceService deviceService;
    private final SchoolService schoolService;

    public IpController(DeviceService deviceService, SchoolService schoolService) {
        this.deviceService = deviceService;
        this.schoolService = schoolService;
    }

    @GetMapping("/iplist")
    public String ipList(@RequestParam(required = false) Long schoolId, Model model) {
        // 학교 목록 조회
        List<School> schools = schoolService.getAllSchools();
        model.addAttribute("schools", schools);

        if (schoolId != null) {
            Optional<School> selectedSchool = schoolService.findById(schoolId);
            if (selectedSchool.isPresent()) {
                School school = selectedSchool.get();
                model.addAttribute("selectedSchool", school);

                // 해당 학교의 모든 장비 조회
                List<Device> devices = deviceService.findDevicesBySchool(school);
                
                // IP 주소 맵 생성 (1-254)
                Map<Integer, Device> deviceMap = devices.stream()
                    .filter(d -> d.getIpAddress() != null && !d.getIpAddress().isEmpty())
                    .collect(Collectors.toMap(
                        d -> {
                            try {
                                String ipAddress = d.getIpAddress().trim();
                                if (!ipAddress.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) {
                                    return -1;
                                }
                                String[] parts = ipAddress.split("\\.");
                                if (parts.length != 4) {
                                    return -1;
                                }
                                int lastOctet = Integer.parseInt(parts[3]);
                                return (lastOctet >= 1 && lastOctet <= 254) ? lastOctet : -1;
                            } catch (Exception e) {
                                logger.error("IP 주소 파싱 오류: {}", d.getIpAddress(), e);
                                return -1;
                            }
                        },
                        d -> d,
                        (existing, replacement) -> existing
                    ));

                // 1부터 254까지의 IP 목록 생성
                List<Map<String, Object>> ipList = IntStream.rangeClosed(1, 254)
                    .mapToObj(i -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("number", i);
                        map.put("device", deviceMap.getOrDefault(i, null));
                        return map;
                    })
                    .collect(Collectors.toList());

                model.addAttribute("ipList", ipList);
            }
        }

        return "ip/iplist";
    }
} 