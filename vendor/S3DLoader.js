THREE.S3DLoader = function () {
    THREE.Loader.call( this );
};

THREE.S3DLoader.prototype = Object.create( THREE.Loader.prototype );
THREE.S3DLoader.prototype.constructor = THREE.S3DLoader;

THREE.S3DLoader.prototype.loadFromUint8Array = function (binaryData) {

    if (!binaryData || !binaryData.length) {
        var geometry = new THREE.BufferGeometry();
        var vertices = new Float32Array([-1.0, -1.0, 1.0]);
        geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
        return geometry;
    }

    var scope = this;
    
    var bstream = new o3dgc.BinaryStream(binaryData);
    var size = binaryData.byteLength;
    
    var decoder = new o3dgc.SC3DMCDecoder();
    var ifs = new o3dgc.IndexedFaceSet();
    decoder.DecodeHeader(ifs, bstream);

    // allocate memory
    if (ifs.GetNCoordIndex() > 0) {
        ifs.SetCoordIndex(new (ifs.GetNCoord() > 65535 ? Uint32Array : Uint16Array)(3 * ifs.GetNCoordIndex()));
    }
    if (ifs.GetNCoord() > 0) {
        ifs.SetCoord(new Float32Array(3 * ifs.GetNCoord()));
    }
    if (ifs.GetNNormal() > 0) {
        ifs.SetNormal(new Float32Array(3 * ifs.GetNNormal()));
    }
    var numNumFloatAttributes = ifs.GetNumFloatAttributes();
    for (var a = 0; a < numNumFloatAttributes; ++a) {
        if (ifs.GetNFloatAttribute(a) > 0) {
            ifs.SetFloatAttribute(a, new Float32Array(ifs.GetFloatAttributeDim(a) * ifs.GetNFloatAttribute(a)));
        }
    }
    var numNumIntAttributes = ifs.GetNumIntAttributes();
    for (var a = 0; a < numNumIntAttributes; ++a) {
        if (ifs.GetNIntAttribute(a) > 0) {
            ifs.SetIntAttribute(a, new Int32Array(ifs.GetIntAttributeDim(a) * ifs.GetNIntAttribute(a)));
        }
    }

    // decode mesh
    decoder.DecodePlayload(ifs, bstream);

    return scope.createModel(ifs);
};

THREE.S3DLoader.prototype.createModel = function (file, callback) {
    var Model = function () {

        THREE.BufferGeometry.call(this);
        this.materials = [];
        var indices = file.GetCoordIndex();
        var positions = file.GetCoord();
        var normals = file.GetNormal();
        var uvs, colors;
        var uvMaps = [];
        if (uvMaps !== undefined && uvMaps.length > 0) {
            uvs = uvMaps[0].uv;
        }
        var attrMaps = [];
        if (attrMaps !== undefined && attrMaps.length > 0 && attrMaps[0].name === 'Color') {
            colors = attrMaps[0].attr;
        }
        this.setIndex(new THREE.BufferAttribute(indices, 1));
        this.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        if (normals !== undefined && normals.length > 0) {
            this.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        }
        if (uvs !== undefined) {
            this.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
        if (colors !== undefined) {
            this.addAttribute('color', new THREE.BufferAttribute(colors, 4));
        }

    };
    Model.prototype = Object.create(THREE.BufferGeometry.prototype);
    Model.prototype.constructor = Model;
    var geometry = new Model();

    // Workaround for inability to render more than 2^20 triangles at once on some environments
    var maxIndicesCount = 1048575 * 3; // 1048575 = (2^20 - 1) = (GL_MAX_ELEMENTS_INDICES - 1)
    var indicesCount = geometry.index.array.length;
    if (indicesCount > maxIndicesCount) {
        for (var groupStartIdx = 0; groupStartIdx < indicesCount; groupStartIdx += maxIndicesCount) {
            if (groupStartIdx + maxIndicesCount > indicesCount) {
                geometry.addGroup(groupStartIdx, indicesCount - groupStartIdx);
            } else {
                geometry.addGroup(groupStartIdx, maxIndicesCount);
            }
        }
    }

    // compute vertex normals if not present in the CTM model
    if (geometry.attributes.normal === undefined) {
        geometry.computeVertexNormals();
    }
    if (callback) {
        callback(geometry);
    } else {
        return geometry;
    }
};
