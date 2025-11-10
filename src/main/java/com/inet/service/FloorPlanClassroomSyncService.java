package com.inet.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inet.entity.FloorPlanElement;
import com.inet.repository.FloorPlanElementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional
public class FloorPlanClassroomSyncService {

    private static final String ELEMENT_TYPE_ROOM = "room";
    private static final String ELEMENT_TYPE_NAME_BOX = "name_box";

    private static final Logger log = LoggerFactory.getLogger(FloorPlanClassroomSyncService.class);

    private final FloorPlanElementRepository floorPlanElementRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public FloorPlanClassroomSyncService(FloorPlanElementRepository floorPlanElementRepository) {
        this.floorPlanElementRepository = floorPlanElementRepository;
    }

    public void updateClassroomElements(Long classroomId, String newRoomName) {
        if (classroomId == null || newRoomName == null) {
            return;
        }

        List<FloorPlanElement> roomElements = floorPlanElementRepository
            .findByReferenceIdAndElementType(classroomId, ELEMENT_TYPE_ROOM);

        if (roomElements.isEmpty()) {
            return;
        }

        for (FloorPlanElement roomElement : roomElements) {
            applyLabelUpdate(roomElement, newRoomName);
            floorPlanElementRepository.save(roomElement);

            updateChildLabelsRecursively(roomElement.getId(), newRoomName);
        }
    }

    public void removeClassroomElements(Long classroomId) {
        if (classroomId == null) {
            return;
        }

        List<FloorPlanElement> relatedElements = floorPlanElementRepository.findByReferenceId(classroomId);
        if (relatedElements.isEmpty()) {
            return;
        }

        Set<Long> elementIdsToDelete = new HashSet<>();
        for (FloorPlanElement element : relatedElements) {
            collectElementWithChildren(element.getId(), elementIdsToDelete);
        }

        if (!elementIdsToDelete.isEmpty()) {
            floorPlanElementRepository.deleteAllById(elementIdsToDelete);
            log.info("Removed {} floor plan elements associated with classroom {}", elementIdsToDelete.size(), classroomId);
        }
    }

    private void updateChildLabelsRecursively(Long parentElementId, String newRoomName) {
        if (parentElementId == null) {
            return;
        }

        List<FloorPlanElement> children = floorPlanElementRepository.findByParentElementId(parentElementId);
        if (children.isEmpty()) {
            return;
        }

        for (FloorPlanElement child : children) {
            if (ELEMENT_TYPE_NAME_BOX.equals(child.getElementType())) {
                applyLabelUpdate(child, newRoomName);
                floorPlanElementRepository.save(child);
            }
            updateChildLabelsRecursively(child.getId(), newRoomName);
        }
    }

    private void applyLabelUpdate(FloorPlanElement element, String newRoomName) {
        element.setLabel(newRoomName);
        if (element.getTextContent() != null) {
            element.setTextContent(newRoomName);
        }
        updateElementDataLabel(element, newRoomName);
    }

    private void updateElementDataLabel(FloorPlanElement element, String newRoomName) {
        String elementData = element.getElementData();
        if (elementData == null || elementData.isEmpty()) {
            return;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(elementData, Map.class);
            boolean updated = false;

            if (data.containsKey("roomName")) {
                data.put("roomName", newRoomName);
                updated = true;
            }
            if (data.containsKey("name")) {
                data.put("name", newRoomName);
                updated = true;
            }
            if (data.containsKey("label")) {
                data.put("label", newRoomName);
                updated = true;
            }

            if (updated) {
                element.setElementData(objectMapper.writeValueAsString(data));
            }
        } catch (Exception ex) {
            log.warn("Failed to update elementData label for element {}: {}", element.getId(), ex.getMessage());
        }
    }

    private void collectElementWithChildren(Long elementId, Set<Long> accumulator) {
        if (elementId == null || accumulator.contains(elementId)) {
            return;
        }

        accumulator.add(elementId);

        List<FloorPlanElement> children = floorPlanElementRepository.findByParentElementId(elementId);
        for (FloorPlanElement child : children) {
            collectElementWithChildren(child.getId(), accumulator);
        }
    }
}

