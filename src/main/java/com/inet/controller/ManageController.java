package com.inet.controller;

import com.inet.service.ManageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/manages")
@RequiredArgsConstructor
public class ManageController {
    private final ManageService manageService;

    @GetMapping("/cates/{schoolId}")
    public ResponseEntity<List<String>> getManageCatesBySchool(@PathVariable Long schoolId) {
        return ResponseEntity.ok(manageService.getManageCatesBySchool(schoolId));
    }

    @GetMapping("/years/{schoolId}/{manageCate}")
    public ResponseEntity<List<Integer>> getYearsBySchoolAndManageCate(
            @PathVariable Long schoolId,
            @PathVariable String manageCate) {
        return ResponseEntity.ok(manageService.getYearsBySchoolAndManageCate(schoolId, manageCate));
    }

    @GetMapping("/next-num/{schoolId}/{manageCate}")
    public ResponseEntity<Long> getNextManageNum(
            @PathVariable Long schoolId,
            @PathVariable String manageCate,
            @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(manageService.getNextManageNum(schoolId, manageCate, year));
    }

    @GetMapping("/nums/{schoolId}/{manageCate}")
    public ResponseEntity<List<Long>> getManageNumsWithNext(
            @PathVariable Long schoolId,
            @PathVariable String manageCate,
            @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(manageService.getManageNumsWithNext(schoolId, manageCate, year));
    }
} 