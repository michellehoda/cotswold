"use strict";

function EditorController($scope, storage, render) {
  /* event handlers */
  angular.element(window).bind('load', function() {
    $scope.reloadView();
  });

  $scope.$watch('title', function(newValue, oldValue) {
    $scope.save();
  });

  jQuery('body').bind('keydown', function(e) {
    if ( $("*:focus").is("textarea, input") ) return;
    if (e.keyCode === 16) {
      $scope.shiftDown = true;
    } else if (e.keyCode === 82) { // 'r'
      $scope.makeRange();
    } else if (e.keyCode === 67) { // 'c'
      $scope.makeConnection();
    } else if (e.keyCode === 77) { // 'm'
      $scope.compare();
    } else if (e.keyCode === 88) { // 'x'
      $scope.removeSelected();
    }
  });

  jQuery('body').bind('keyup', function(e) {
    if (e.keyCode === 16) {
      $scope.shiftDown = false;
    }
  });

  /* scope methods */
  $scope.createDocument = function () {
    var createNewDocument = confirm("Create a new document? (Unsaved changes will be lost.)");
    if (createNewDocument) {
      $scope.clearAllData();
      $scope.title = "New Document";
    }
  }

  $scope.saveDocument = function () {
    var s = stringify({
      timepoints: $scope.timepoints,
      expanded: $scope.expanded,
      connections: $scope.connections,
      title: $scope.title,
    });
    var bb = new Blob([s], {type: "application/json"});
    var link = document.createElement("a");
    link.download = $scope.title;
    link.href = window.URL.createObjectURL(bb);
    link.click();
  }

  $scope.cancelOpenDocument = function () {
    $scope.dialogVisible = false;
    $scope.reloadView();
    initFileInput("dataFile", $scope.handleLoadDataFromFile);
  }

  $scope.openDocument = function () {
    $scope.dialogVisible = false;
    // clearing the data first is necessary in case there are parts of the old
    // data set in the new one (they could screw up the order in which things are displayed)
    $scope.clearAllData();
    $scope.reloadView();
    $scope.loadData($scope.documentData);
    initFileInput("dataFile", $scope.handleLoadDataFromFile);
  }

  $scope.showOpenDocumentDialog = function () {
    $scope.dialogVisible = true;
    $scope.reloadView();
  }

  $scope.compare = function () {
    var artifactsToCompare = [];
    // iterate through timepoints to see which have their compare boxes checked
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.checkedForComparison) {
        for (var j=0; j<timepoint.artifacts.length; j++) {
          var artifact = timepoint.artifacts[j];
          if (!artifact.imageSrc) {
            artifactsToCompare.push(artifact);
          }
        }
      }
    }


    // if there are exactly two, get the first textual artifact from each
    if (artifactsToCompare.length !== 2) {
      return;
    }

    // run the comparison and create ranges for the changes
    var a1 = artifactsToCompare[0];
    var a2 = artifactsToCompare[1];
    var a1Index = 0;
    var a2Index = 0;
    var r1, r2;
    var diff = JsDiff.diffWords(a1["content"], a2["content"]);
    diff.forEach(function(part){
      var changeLength = part.value.length;
      if (part.added) {
        //r1 = $scope.addRangeObject(a1, a1Index, a1Index+1, "color2", false);
        r2 = $scope.addRangeObject(a2, a2Index, a2Index + changeLength, "color2", false);
        //$scope.addConnectionObject(r1, r2);
        a2Index += changeLength;
      } else if (part.removed) {
        //r1 = $scope.addRangeObject(a2, a2Index, a2Index+1, "color1", false);
        r2 = $scope.addRangeObject(a1, a1Index, a1Index + changeLength, "color1", false);
        //$scope.addConnectionObject(r1, r2);
        a1Index += changeLength;
      } else {
        a1Index += changeLength;
        a2Index += changeLength;
      }
    });

    // if we're making connections we don't want to reload view until both artifacts have updated
    $scope.reloadArtifactNodes(a1, false);
    $scope.reloadArtifactNodes(a2);
  }

  $scope.handleLoadDataFromFile = function (e) {
    var files = e.target.files; // FileList object

    var reader = new FileReader();
    reader.onload = (function(theFile) {
      return function(e) {
        $scope.documentData = e.target.result;
      };
    })(files[0]);
    reader.readAsText(files[0]);
  };

  $scope.handleLoadArtifactFromFile = function (e, timepointId) {
    if ($scope.timepoints === null || $scope.timepoints.length === 0) {
      alert("At least one timepoint must exist before an artifact can be added.");
    } else {
      var files = e.target.files; // FileList object

      for (var i = 0, f; f = files[i]; i++) {
        var reader = new FileReader();
        var isImage = isImageFile(f.name);

        reader.onload = (function(theFile) {
          return function(e) {
            var artifact;
            if (isImage) {
              artifact = $scope.makeImageArtifact(e.target.result);
            } else {
              artifact = $scope.makeTextArtifact(e.target.result);
            }
            var timepoint = $scope.getTimepointById(timepointId);
            if (timepoint) {
              timepoint.artifacts.push(artifact);
              $scope.reloadAllNodes();
            }
          };
        })(f);

        if (isImage) {
          reader.readAsDataURL(f);
        } else {
          reader.readAsText(f);
        }
      }
    }
  };


  $scope.clearAllData = function () {
    $scope.timepoints = [];
    $scope.expanded = false;
    $scope.connections = [];
    $scope.reloadView();
  }

  // loads data whether it is JSON stringified or not
  $scope.loadData = function (data) {
    $scope.timepoints = [];
    $scope.expanded = false;
    $scope.connections = [];
    $scope.title = "";

    if (typeof data == 'string' || data instanceof String) {
      data = JSON.parse(data);
      $scope.timepoints = data["timepoints"];
      $scope.expanded = data["expanded"];
      $scope.connections = data["connections"];
      $scope.title = data["title"];
    } else {
      if ("timepoints" in data) {
        $scope.timepoints = JSON.parse(data["timepoints"]);
      } 
      if ("expanded" in data) {
        $scope.expanded = JSON.parse(data["expanded"]);
      } 
      if ("connections" in data) {
        $scope.connections = JSON.parse(data["connections"]);
      } 
      if ("title" in data) {
        $scope.title = data["title"];
      } 

      if (!("initialized" in data)) {
        data = GETTYSBURG;
        $scope.timepoints = data["timepoints"];
        $scope.expanded = data["expanded"];
        $scope.connections = data["connections"];
        $scope.title = data["title"];
      }
    }
    $scope.reloadAllNodes(); 
    $scope.reloadView();
  }

  $scope.save = function () {
    storage["timepoints"] = stringifyWhenSaving($scope.timepoints);
    storage["expanded"] = stringifyWhenSaving($scope.expanded);
    storage["connections"] = stringifyWhenSaving($scope.connections);
    storage["title"] = $scope.title;
    storage["initialized"] = true;
  }

  $scope.reloadView = function () {
    render($scope);
    // save whenever we reload on the theory that if we're showing the 
    // change to the user we should probably remember it
    $scope.save();
  };


  $scope.reloadArtifactNodes = function(artifact, reloadView) {
    artifact.nodes = makeSpanTree(artifact.ranges, artifact.content).nodes;

    // by default we reload the view
    if (reloadView || reloadView === undefined) {
      $scope.reloadView();
    }
  }

  $scope.reloadAllNodes = function(artifact) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        $scope.reloadArtifactNodes(timepoint.artifacts[j], false);
      }
    }
    $scope.reloadView();
  }

  $scope.makeImageRange = function (artifactId, x, y, width, height) {
    var artifact = $scope.getArtifactById(artifactId);
    var newRangeId = null;
    if (artifact) {
      newRangeId = "box"+artifact.id+(artifact.ranges.length+1);
      artifact.ranges.push(
        {
          left: x,
          top: y,
          width: width,
          height: height,
          id: newRangeId,
          color: "color1",
          note: "",
          selected: true
        }
      );
      $scope.reloadArtifactNodes(artifact);
    }

    if (newRangeId) {
      // even though new range is already selected, 
      // need to make sure everything else is unselected
      $scope.updateSelection(newRangeId, true);
    }
  }

  $scope.makeTimepoint = function () {
    // for now, just append a new timepoint to the end
    var nextId = $scope.getNextTimepointId();
    $scope.timepoints.push({
      id: nextId, name: "Timepoint "+nextId, selected: false, artifacts: []
    });

    $scope.reloadAllNodes();
  }

  $scope.removeConnectionsForArtifacts = function (artifacts) {
    var ranges = {};
    if (artifacts) {
      for (var j=0; j<artifacts.length; j++) {
        var artifact = artifacts[j];
        if (artifact.ranges) {
          for (var k=0; k<artifact.ranges.length; k++) {
            var range = artifact.ranges[k];
            ranges[range.id] = true;
          }
        }
      }

      // remove all connections into this timepoint
      for (var l=$scope.connections.length-1; l>=0; l--) {
        var connection = $scope.connections[l];
        if (connection.rangeIds[0] in ranges 
          || connection.rangeIds[1] in ranges) {
          $scope.connections.splice(l, 1);
        }
      }
    }
  }

  $scope.deleteTimepoint = function (timepointId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.id === timepointId) {
        // remove related connections
        $scope.removeConnectionsForArtifacts(timepoint.artifacts);

        // remove timepoint
        $scope.timepoints.splice(i, 1);
        break;
      }
    }

    $scope.reloadAllNodes();
  }

  $scope.selectTimepoint = function (timepointId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      timepoint.selected = (timepoint.id === timepointId);
    }
    $scope.reloadView();
  }

  $scope.setTimepointTitle = function (timepointId, newTitle) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.id === timepointId) {
        timepoint.name = newTitle;
      }
    }
  }

  $scope.clearAllSelectedTimepoints = function(reload) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      timepoint.selected = false;
    }
    if (reload)
      $scope.reloadAllNodes();
  };

  $scope.makeRange = function () {
    $scope.clearAllSelectedElements();
    var sel = rangy.getSelection();
    var startArtifact = getArtifactAncestor(sel.anchorNode);
    var endArtifact = getArtifactAncestor(sel.focusNode);
    var startOffset = getCaretCharacterOffsetWithin(
      startArtifact.firstElementChild, true
    );
    var endOffset = getCaretCharacterOffsetWithin(
      startArtifact.firstElementChild, false
    );

    if (startArtifact.id != endArtifact.id) {
      sel.removeAllRanges();
      return;
    }

    var newRangeId = null;
    var artifact = $scope.getArtifactById(startArtifact.id);
    if (artifact) {
      newRangeId = $scope.addRangeObject(artifact, startOffset, endOffset, "color1", true).id;
      $scope.reloadArtifactNodes(artifact);
    }

    if (newRangeId) {
      // even though new range is already selected, 
      // need to make sure everything else is unselected
      $scope.updateSelection(newRangeId, true);
    }
  };

  $scope.addRangeObject = function (artifact, start, end, color, selected) {
    var newRangeId = "range"+artifact.id+(artifact.ranges.length+1);
    var newRange = {
      start: start, 
      end: end, 
      id: newRangeId,
      style: "red", // FIXME is this used?
      color: color,
      note: "",
      selected: selected
    }
    artifact.ranges.push(newRange);
    return newRange;
  }

  $scope.removeSelected = function () {
    var selectedConnection = $scope.getSelectedConnection();
    if (selectedConnection) {
      $scope.removeConnection(selectedConnection.id);
    } else {
      $scope.removeRange();
    }
  }

  $scope.removeRange = function () {
    var selectedRange;
    var selectedRanges = $scope.getSelectedRanges();
    if (selectedRanges.length === 1) {
      selectedRange = selectedRanges[0];
    } else {
      console.log(selectedRanges.length + " range(s) selected: refusing to remove range.");
      return;
    }
    
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var artifact = timepoint.artifacts[j];
        if (artifact.ranges) {
          for (var k=0; k<artifact.ranges.length; k++) {
            var range = artifact.ranges[k];
            if (range === selectedRange) {
              if ($scope.rangeIsConnected(range.id)) {
                console.log("Range "+range.id+" is connected: refusing to remove")
              } else {
                artifact.ranges.splice(k, 1);
                $scope.reloadArtifactNodes(artifact);
              }

              break;
            }
          }
        }
      }
    }
  };

  $scope.rangeIsConnected = function(rangeId) {
    for (var l=0; l<$scope.connections.length; l++) {
      var connection = $scope.connections[l];
      if (connection.rangeIds.indexOf(rangeId) != -1) {
        return true;
      }
    }
    return false;
  };

  $scope.dumpSpanTree = function() {
    return stringify($scope.timepoints);
  };

  $scope.shiftDown = false;

  $scope.previousSelection = null;
  $scope.updateSelection = function(rangeIdToSelect, clearPrevious) {
    var newlySelected = null;
    if (clearPrevious == null) clearPrevious = !$scope.shiftDown;
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var artifact = timepoint.artifacts[j];
        if (artifact.ranges) {
          for (var k=0; k<artifact.ranges.length; k++) {
            var range = artifact.ranges[k];

            if (range.id == rangeIdToSelect) {
              range.selected = true;
              newlySelected = range.id;
            } else if (clearPrevious || $scope.previousSelection != range.id) {
              range.selected = false;
            }
          }
          $scope.reloadArtifactNodes(artifact);
        }
      }
    }
    $scope.previousSelection = newlySelected;
  };

  $scope.setConnectionColor = function(connectionId, color) {
    var connection = $scope.getConnectionById(connectionId);
    if (connection) {
      connection.color = color;
      $scope.reloadView();
    }
  }

  $scope.setRangeColor = function(rangeId, color) {
    var range = $scope.getRangeById(rangeId);
    if (range) {
      range.color = color;
      $scope.reloadAllNodes();
    }
  }

  $scope.setRangeStyle = function(rangeId, clickedStyle) {
    var range = $scope.getRangeById(rangeId);
    if (range) {
      if (!range.styles) {
        range.styles = [];
      }
      var removeThis = -1;
      for (var i=0; i<range.styles.length; i++) {
        var style = range.styles[i];
        if (style.name === clickedStyle.name) {
          removeThis = i;
          break;
        }
      }
      if (removeThis == -1) {
        range.styles.push(clickedStyle);
      } else {
        range.styles.splice(removeThis, 1);
      }
      $scope.reloadAllNodes();
    }
  }

  $scope.setConnectionNote = function(connectionId, note) {
    var connection = $scope.getConnectionById(connectionId);
    if (connection) {
      connection.note = note;
      //$scope.reloadView();
    }
  }

  $scope.setRangeNote = function(rangeId, note) {
    var range = $scope.getRangeById(rangeId);
    if (range) {
      range.note = note;
      //$scope.reloadAllNodes();
    }
  }

  $scope.getSelectedConnection = function() {
    for (var i=0; i<$scope.connections.length; i++) {
      if ($scope.connections[i].selected) 
        return $scope.connections[i];
    }
    return null;
  }

  $scope.getSelectedRanges = function() {
    var selectedRanges = [];
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var artifact = timepoint.artifacts[j];
        if (artifact.ranges) {
          for (var k=0; k<artifact.ranges.length; k++) {
            var range = artifact.ranges[k];
            if (range.selected) {
              selectedRanges.push(range);
            }
          }
        }
      }
    }
    return selectedRanges;
  };
 
  $scope.rangeIsSelected = function(rangeId) {
    var selectedRanges = $scope.getSelectedRanges();
    for (var i=0; i<selectedRanges; i++) {
      var selectedRange = selectedRanges[i];
      if (selectedRange.id === rangeId) {
        return true;
      }
    }
    return false;
  };

  $scope.clearAllSelectedElements = function(reload) {
    var cleared = $scope.clearAllSelectedConnections(false);
    cleared = cleared || $scope.clearAllSelectedRanges(false);
    cleared = cleared || $scope.clearAllSelectedTimepoints(false);
    if (cleared && reload) {
      $scope.reloadAllNodes();
    }
  }

  $scope.selectTimepoint = function (timepointId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      timepoint.selected = (timepoint.id === timepointId);
    }
    $scope.reloadView();
  }

  $scope.clearAllSelectedTimepoints = function(reload) {
    var cleared = false;
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.selected) cleared = true;
      timepoint.selected = false;
    }
    if (reload)
      $scope.reloadAllNodes();
    return cleared;
  };

  $scope.clearAllSelectedConnections = function(reload) {
    var cleared = false;
    for (var i=0; i<$scope.connections.length; i++) {
      var connection = $scope.connections[i];
      if (connection.selected) cleared = true;
      connection.selected = false;
    }
    if (reload)
      $scope.reloadAllNodes();
    return cleared;
  };

  $scope.clearAllSelectedRanges = function(reload) {
    var cleared = false;
    var selectedRanges = $scope.getSelectedRanges();
    for (var i=0; i<selectedRanges.length; i++) {
      if (selectedRanges[i].selected) cleared = true;
      selectedRanges[i].selected = false;
    }
    if (reload)
      $scope.reloadAllNodes();
    return cleared;
  };

  $scope.rangeIsConnectable = function(rangeId) {
    var selectedRanges = $scope.getSelectedRanges();
    var thisSelectedRange = null;
    var otherSelectedRange = null;

    // there must be one or two ranges selected
    if (selectedRanges.length > 2 
      || selectedRanges.length === 0) {
      return false;
    }

    // if there are two selected, one must match rangeId
    // and they must not be connected
    if (selectedRanges.length === 2
      && ((selectedRanges[0].id !== rangeId && selectedRanges[1].id !== rangeId)
        || $scope.rangesAreConnected(selectedRanges[0].id, selectedRanges[1].id))) {
      return false;
    }
 
    // if there is one selected, it must not match rangeId
    if (selectedRanges.length === 1
      && (selectedRanges[0].id === rangeId
        || $scope.rangesAreConnected(selectedRanges[0].id, rangeId))) {
      return false;
    }

    return true;
  }

  $scope.rangesAreConnected = function (rangeId1, rangeId2) {
    for (var i=0; i<$scope.connections.length; i++) {
      var connection = $scope.connections[i];
      if (connection.rangeIds.indexOf(rangeId1) != -1 && connection.rangeIds.indexOf(rangeId2) != -1) {
        return true;
      }
    }
    return false;
  }

  $scope.makeConnection = function() {
    var selectedRanges = $scope.getSelectedRanges();
    if (selectedRanges.length === 2) {
      var r1 = selectedRanges[0];
      var r2 = selectedRanges[1];
      $scope.addConnectionObject(r1, r2);
      $scope.reloadView();
    } else {
      console.log(selectedRanges.length + " range(s) selected: refusing to create connection.");
    }
  };

  $scope.addConnectionObject = function(r1, r2) {
    if ($scope.rangesAreConnected(r1.id, r2.id)) {
      console.log("Connection between "+r1.id+" and "+r2.id+" already exists: refusing to create connection");
    } else {
      $scope.connections.push({ rangeIds: [r1.id, r2.id], selected: false, id: r1.id+"-"+r2.id, note:"", color: "color1"});
    }
  }

  $scope.removeConnection = function (connectionId) {
    var selectedRanges = $scope.getSelectedRanges();
    if (selectedRanges.length === 2 || connectionId) {
      for (var i=0; i<$scope.connections.length; i++) {
        var connection = $scope.connections[i];
        if (connectionId) {
          // if connectionId set, don't delete connection
          // between selected ranges even if it exists
          if (connectionId === connection.id) {
            $scope.connections.splice(i, 1);
            $scope.reloadView();
            break;
          }
        } else if (connection.rangeIds.indexOf(selectedRanges[0].id) !== -1 
          && connection.rangeIds.indexOf(selectedRanges[1].id) !== -1) {
          $scope.connections.splice(i, 1);
          $scope.reloadView();
          break;
        }
      }
    } else {
      console.log(selectedRanges.length + " range(s) selected: refusing to remove connection.");
    }
  };

  $scope.selectConnection = function (connectionId) {
    for (var i=0; i<$scope.connections.length; i++) {
      var connection = $scope.connections[i];
      connection.selected = (connection.id === connectionId);
    }
    $scope.reloadView();
  }

  $scope.getArtifactById = function (artifactId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var artifact = timepoint.artifacts[j];
        if (artifact.id == artifactId) {
          return artifact;
        }
      }
    }
    return null;
  };


  $scope.getConnectionById = function (connectionId) {
    for (var i=0; i<$scope.connections.length; i++) {
      var connection = $scope.connections[i];
      if (connection.id == connectionId) {
        return connection;
      }
    }
    return null;
  }
  $scope.getRangeById = function (rangeId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var artifact = timepoint.artifacts[j];
        if (artifact.ranges) {
          for (var k=0; k<artifact.ranges.length; k++) {
            var range = artifact.ranges[k];
            if (range.id === rangeId) {
              return range;
            }
          }
        }
      }
    }
    return null;
  };

  $scope.getNextArtifactId = function () {
    var nextId = 1;
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      for (var j=0; j<timepoint.artifacts.length; j++) {
        var aId = parseInt(timepoint.artifacts[j].id.slice(1), 10);
        if (nextId < aId) {
          nextId = aId;
        }
      }
    }
    return "a"+(nextId+1);
  };

  $scope.getNextTimepointId = function () {
    var nextId = 0;
    for (var i=0; i<$scope.timepoints.length; i++) {
      var tId = parseInt($scope.timepoints[i].id.slice(1), 10);
      if (nextId < tId) {
        nextId = tId;
      }
    }
    return "t"+(nextId+1);
  };

  $scope.makeTextArtifact = function (text) {
    return { 
      id: $scope.getNextArtifactId(),
      imageDisplay: "none",
      contentDisplay: "block",
      content: text,
      ranges: [],
      width: ARTIFACT_WIDTH_NORMAL,
      maxHeight: ARTIFACT_MAX_HEIGHT_NORMAL,
    };
  };

  $scope.makeImageArtifact = function (imageSrc) {
    return { 
      id: $scope.getNextArtifactId(),
      imageDisplay: "block",
      contentDisplay: "none",
      imageSrc: imageSrc,
      ranges: [],
      width: ARTIFACT_WIDTH_NORMAL,
      maxHeight: ARTIFACT_MAX_HEIGHT_NORMAL,
    };
  };

  $scope.getTimepointById = function (timepointId) {
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.id === timepointId) {
        return timepoint;
      }
    }
    return null;
  };
  $scope.deleteArtifact = function (artifactId) {
    var foundArtifact = false;
    for (var i=0; i<$scope.timepoints.length; i++) {
      var timepoint = $scope.timepoints[i];
      if (timepoint.artifacts) {
        var artifacts = timepoint.artifacts;
        for (var j=0; j<artifacts.length; j++) {
          var artifact = artifacts[j];
          if (artifactId === artifact.id) {
            // remove related connections
            $scope.removeConnectionsForArtifacts([artifact]);
            // remove timepoint
            timepoint.artifacts.splice(j, 1);
            foundArtifact = true;
            break;
          }
        }
      }
      if (foundArtifact) break;
    }

    $scope.reloadAllNodes();
  };

  initFileInput("dataFile", $scope.handleLoadDataFromFile);

  $scope.loadData(storage);
  $scope.reloadAllNodes();
  
}

function getArtifactAncestor(node) {
  while (node && node.className != "artifact") {
    node = node.parentNode;
  }
  return node;
}

// adapted from: http://aspnetupload.com/Clear-HTML-File-Input.aspx
// FIXME: duplicates functionality of clearFileInput in view.js (that one is better)
function initFileInput(elementId, changeHandler) {
  var oldInput = document.getElementById(elementId); 
  var newInput = document.createElement("input"); 
  newInput.type = "file"; 
  newInput.id = oldInput.id; 
  newInput.name = oldInput.name; 
  newInput.className = oldInput.className; 
  newInput.style.cssText = oldInput.style.cssText; 
  oldInput.parentNode.replaceChild(newInput, oldInput); 
  jQuery('#'+elementId).bind('change', changeHandler);
}


// Adapted from: http://stackoverflow.com/questions/4811822/get-a-ranges-start-and-end-offsets-relative-to-its-parent-container
// Thanks, Tim Down!
function getCaretCharacterOffsetWithin(element, start) {
    var caretOffset = 0;
    if (typeof window.getSelection != "undefined") {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        if (start) {
          preCaretRange.setEnd(range.startContainer, range.startOffset);
        } else {
          preCaretRange.setEnd(range.endContainer, range.endOffset);
        }
        caretOffset = preCaretRange.toString().length;
    } else if (typeof document.selection != "undefined" && document.selection.type != "Control") {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

function stringify(obj) {
  // http://stackoverflow.com/questions/9382167/serializing-object-that-contains-cyclic-object-value
  var seen = []
  return JSON.stringify(
    obj,
    function(key, val) {
      if (key == "$$hashKey") {
        return undefined;
      }
       
      if (typeof val == "object") {
        if (seen.indexOf(val) >= 0)
          return undefined;
        seen.push(val);
      }
      return val;
    }
  );
}

// ignores keys called "nodes" since these contain cycles and are 
// ephemeral anyway (used for hierarchical text range handling)
function stringifyWhenSaving(obj) {
  return JSON.stringify(
    obj,
    function(key, val) {
      if (key == "nodes") {
        return undefined;
      } else {
        return val;
      }
    }
  );
}


function isImageFile(fileName) {
  var lcName = fileName.toLowerCase();
  return endsWith(lcName, ".png") ||
    endsWith(lcName, ".gif") ||
    endsWith(lcName, ".jpg") ||
    endsWith(lcName, ".jpeg");
}

function endsWith(s, suffix) {
    return s.indexOf(suffix, s.length - suffix.length) !== -1;
}

