import pytest


@pytest.fixture
def platform():
    return{
        'term_name': 'ChIP-seq',
        'term_id': 'OBI:0000716'	
    }

@pytest.fixture
def platform_1(platform):
    item = platform.copy()
    item.update({
        'schema_version': '1',
        'encode2_dbxrefs': ['AB_SOLiD_3.5'],
        'geo_dbxrefs': ['GPL9442'],
    })
    return item


def test_platform_upgrade(app, platform_1):
    migrator = app.registry['migrator']
    value = migrator.upgrade('platform', platform_1, target_version='2')
    assert value['schema_version'] == '2'
    assert 'encode2_dbxrefs' not in value
    assert 'geo_dbxrefs' not in value
    assert value['dbxrefs'] == ['ucsc_encode_db:AB_SOLiD_3.5', 'geo_db:GPL9442']
