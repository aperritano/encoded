import React from 'react';
import PropTypes from 'prop-types';
import QueryString from '../../libs/query_string';
import FacetRegistry from './registry';


export const DefaultTerm = ({ term, facet, results, pathname, queryString }) => {
    let href;
    const termFilter = results.filters.find(filter => filter.field === facet.field && filter.term === term.key);
    if (termFilter) {
        // Term is selected, so its link URL is the remove property of the matching filter.
        href = termFilter.remove;
    } else {
        const query = new QueryString(queryString);
        query.addKeyValue(facet.field, term.key);
        href = `${pathname}?${query.format()}`;
    }
    return (
        <li className={`facet-term${termFilter ? ' selected' : ''}`}>
            <a href={href} className="facet-term__item">{term.key}</a>
        </li>
    );
};

DefaultTerm.propTypes = {
    /** facet.terms object for the term we're rendering */
    term: PropTypes.object.isRequired,
    /** results.facets object for the facet whose term we're rendering */
    facet: PropTypes.object.isRequired,
    /** Search results object */
    results: PropTypes.object.isRequired,
    /** Search results path without query-string portion */
    pathname: PropTypes.string.isRequired,
    /** Query-string portion of current URL without initial ? */
    queryString: PropTypes.string.isRequired,
};


export const DefaultTitle = ({ facet }) => (
    <h5>{facet.title}</h5>
);

DefaultTitle.propTypes = {
    /** results.facets object for the facet whose title we're rendering */
    facet: PropTypes.object.isRequired,
};


export const DefaultFacet = ({ facet, results, pathname, queryString }) => {
    const TitleComponent = FacetRegistry.Title.lookup(facet.field);
    return (
        <div className="facet">
            {TitleComponent && <TitleComponent facet={facet} results={results} pathname={pathname} queryString={queryString} />}
            <ul className="facet__content">
                <div className="facet__terms">
                    <div className="term-list">
                        <div>
                            {facet.terms.map(term => (
                                <DefaultTerm key={term.key} term={term} facet={facet} results={results} pathname={pathname} queryString={queryString} />
                            ))}
                        </div>
                    </div>
                </div>
            </ul>
        </div>
    );
};

DefaultFacet.propTypes = {
    /** Relevant `facet` object in `facets` array in `results` */
    facet: PropTypes.object.isRequired,
    /** Complete search-results object */
    results: PropTypes.object.isRequired,
    /** Search results path without query-string portion */
    pathname: PropTypes.string.isRequired,
    /** Query-string portion of current URL without initial ? */
    queryString: PropTypes.string.isRequired,
};
